/** The per-kind geometry contract, through a kind that is not text: a gem whose facets are its outline. */
import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import type { PathEffect } from 'core/scene/pathEffects/effects';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from 'domains/pathEffects/index';
import { outsideGeneration } from 'core/scene/outsideReads';
import type { EffectItem } from 'core/scene/pathEffects/source';
import { createSceneSnapIndexer } from 'domains/paths/pathSnap/sceneIndex';
import { effectSourceFor } from 'domains/pathEffects/effectSources';
import { readEffectSource } from 'domains/pathEffects/readSource';
import { findShapeSilhouette } from './NodeShape';
import { geometryGenerationOf, NodeOutlineError, sceneNodeOutline, type NodeOutline } from './nodeOutline';
import { nodeShapesOf } from './nodeShapeRegistry';
import type { NodeShapeEntry } from './nodeShapeTypes';

type Gem = { gem: { facets: number }; fill?: unknown };
const isGem = (data: unknown): data is Gem => typeof data === 'object' && data !== null && 'gem' in data;
const diamond = pathFromD('M50 0 L100 50 L50 100 L0 50 Z');
const ITEM: EffectItem = { length: 10, middle: 5, parts: [] };

/** A gem painter whose geometry moves with `cut`, outside any node. */
function gemKind() {
  let cut = 0;
  let built = 0;
  const seen: unknown[] = [];
  const entry: NodeShapeEntry = {
    id: 'test:gem',
    matches: (n) => isGem(n.data),
    paint: () => [],
    silhouette: () => { built++; return diamond; },
    outline: (_n, _p, ctx): NodeOutline => {
      seen.push(ctx?.inherited);
      return {
        stroked: false,
        path: () => diamond,
        parts: () => {
          if (cut === 0) throw new NodeOutlineError('not cut', { summary: 'The gem is uncut', pending: true });
          return [{ path: diamond, fill: null }];
        },
        load: () => { cut++; return Promise.resolve(); },
      };
    },
    geometryGeneration: () => cut,
    effectItems: () => [ITEM],
  };
  return { entry, seen, recut: () => { cut++; }, built: () => built };
}

function sceneWith(entry: NodeShapeEntry) {
  const scene = createScene<Record<string, unknown>, 'default', { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'default' }],
  });
  const release = nodeShapesOf(scene).register(entry);
  const add = (id: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data, ...extra });
    return scene.get(asNodeId(id))!;
  };
  return { scene, add, release };
}

describe('NodeShapeEntry.outline', () => {
  it('is what sceneNodeOutline answers for a node of the kind, and nothing for another', async () => {
    const gem = gemKind();
    const { scene, add } = sceneWith(gem.entry);
    add('g', { gem: { facets: 8 } });
    add('r', { path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } });
    const outline = sceneNodeOutline(scene, 'g')!;
    expect(outline.path()).toBe(diamond);
    expect(() => outline.parts()).toThrow(NodeOutlineError);
    await outline.load();
    expect(outline.parts()).toEqual([{ path: diamond, fill: null }]);
    expect(sceneNodeOutline(scene, 'r')).toBeUndefined();
    expect(sceneNodeOutline(scene, 'missing')).toBeUndefined();
  });

  it("hands the kind the paint the node inherits from its container", () => {
    const gem = gemKind();
    const { scene, add } = sceneWith(gem.entry);
    const fill = { paint: { kind: 'solid', color: '#0a0' } };
    scene.add({ id: asNodeId('box'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { fill } });
    add('g', { gem: { facets: 8 }, fill: 'inherit' }, { parent: 'box' });
    sceneNodeOutline(scene, 'g');
    expect(gem.seen.at(-1)).toMatchObject({ fill });
  });
});

describe('NodeShapeEntry.geometryGeneration', () => {
  it('rebuilds a memoized silhouette when it moves, and only then', () => {
    const gem = gemKind();
    const { scene, add } = sceneWith(gem.entry);
    const node = add('g', { gem: { facets: 8 } });
    const shapes = nodeShapesOf(scene);
    findShapeSilhouette(node, node.pose, { shapes });
    findShapeSilhouette(node, node.pose, { shapes });
    expect(gem.built()).toBe(1);
    gem.recut();
    findShapeSilhouette(node, node.pose, { shapes });
    expect(gem.built()).toBe(2);
  });

  it('rebuilds a silhouette whose silhouetteKey changed', () => {
    let built = 0;
    const entry: NodeShapeEntry = {
      id: 'test:scaled', matches: (n) => isGem(n.data), paint: () => [],
      silhouette: () => { built++; return diamond; },
      silhouetteKey: (_n, ctx) => ctx?.scale ?? 1,
    };
    const { scene, add } = sceneWith(entry);
    const node = add('g', { gem: { facets: 8 } });
    const shapes = nodeShapesOf(scene);
    findShapeSilhouette(node, node.pose, { shapes, scale: 2 });
    findShapeSilhouette(node, node.pose, { shapes, scale: 2 });
    findShapeSilhouette(node, node.pose, { shapes, scale: 3 });
    expect(built).toBe(2);
  });

  it("is summed over a registry's painters, which the snap index keys on", () => {
    const gem = gemKind();
    const { scene, add } = sceneWith(gem.entry);
    add('g', { gem: { facets: 8 } });
    const shapes = nodeShapesOf(scene);
    const before = geometryGenerationOf(shapes);
    const index = createSceneSnapIndexer(scene);
    const first = index();
    expect(index()).toBe(first);
    gem.recut();
    expect(geometryGenerationOf(shapes)).toBe(before + 1);
    expect(index()).not.toBe(first);
  });

  it('counts among the outside sources a derivation checks while the kind is registered', () => {
    const gem = gemKind();
    const { release } = sceneWith(gem.entry);
    const before = outsideGeneration();
    gem.recut();
    expect(outsideGeneration()).toBe(before + 1);
    release();
    gem.recut();
    expect(outsideGeneration()).toBe(before);
  });
});

describe('NodeShapeEntry.effectItems', () => {
  it("is a path effect's items, and makes the kind the source an items edit goes to", () => {
    const gem = gemKind();
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const scene = createScene<unknown, 'main', typeof box>({
      systemLayers: [{ id: 'main' }],
      registry: withPathEffectsRegistry(),
      initial: [
        { id: asNodeId('g'), kind: 'mark', layer: 'main', pose: box, data: { gem: { facets: 8 } } },
        { id: asNodeId('p'), kind: 'mark', layer: 'main', pose: box, data: { path: pathFromD('M0 50 L100 50') } },
        { ...pathEffectNode({ kind: 'textAlong', hideSources: true } as PathEffect, [asNodeId('g'), asNodeId('p')], 'main', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
      ],
    });
    nodeShapesOf(scene).register(gem.entry);
    expect(effectSourceFor(scene, asNodeId('fx'), 'items')).toBe('g');
    const g = scene.get(asNodeId('g'))!;
    const source = readEffectSource({ node: g, pose: g.pose, path: null, scene } as never);
    expect(source?.items?.()).toEqual([ITEM]);
  });
});
