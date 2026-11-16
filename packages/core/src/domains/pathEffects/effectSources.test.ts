import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import type { PathEffect } from 'core/scene/pathEffects/effects';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { effectSourceFor, effectsShowing } from './effectSources';
import { hiddenSourcesTakenWith } from './hiddenSources';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';
import { nodeShapesOf } from 'canvas/nodeShapeRegistry';
import type { EffectItem } from 'core/scene/pathEffects/source';

const T = asNodeId('t');
const P = asNodeId('p');
const Q = asNodeId('q');
const S = asNodeId('s');
const FX = asNodeId('fx');
const BOX = { x: 0, y: 0, width: 100, height: 20 };
const line = { path: pathFromD('M0 50 L100 50') };
const ITEM: EffectItem = { length: 10, middle: 5, parts: [] };
/** A kind its painter lays out as items, the way `kit:text` lays out its glyphs. */
const beads = { beads: 3 };

function sceneWith(effect: PathEffect, sources: string[], extra: readonly object[] = []) {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: BOX, data: beads },
      { id: P, kind: 'mark', layer: 'main', pose: BOX, data: line },
      { id: Q, kind: 'mark', layer: 'main', pose: BOX, data: line },
      { id: S, kind: 'mark', layer: 'main', pose: BOX, data: line },
      { ...pathEffectNode(effect, sources.map(asNodeId), 'main', PATH_EFFECT_DERIVATIONS), id: FX },
      ...(extra as never[]),
    ],
  });
  nodeShapesOf(scene).register({
    id: 'test:beads', matches: (n) => typeof n.data === 'object' && n.data !== null && 'beads' in n.data, paint: () => [], effectItems: () => [ITEM],
  });
  return scene;
}

describe('effectSourceFor', () => {
  it("answers a text-along node's items and path", () => {
    const scene = sceneWith({ kind: 'textAlong', hideSources: true }, ['t', 'p']);
    expect(effectSourceFor(scene, FX, 'items')).toBe(T);
    expect(effectSourceFor(scene, FX, 'path')).toBe(P);
  });

  it('answers the path of every along kind, and no items where the shape lays out none', () => {
    for (const kind of ['bendAlong', 'repeatAlong'] as const) {
      const scene = sceneWith({ kind, hideSources: true } as PathEffect, ['q', 'p']);
      expect(effectSourceFor(scene, FX, 'path')).toBe(P);
      expect(effectSourceFor(scene, FX, 'items')).toBeNull();
    }
  });

  it('answers no path for an effect of one shape', () => {
    for (const kind of ['roughen', 'zigzag', 'puckerBloat'] as const) {
      expect(effectSourceFor(sceneWith({ kind, hideSources: true } as PathEffect, ['q']), FX, 'path')).toBeNull();
    }
  });

  it("answers a tween's spine as its path, and none without one", () => {
    expect(effectSourceFor(sceneWith({ kind: 'tween', steps: 3, hideSources: true } as PathEffect, ['q', 's', 'p']), FX, 'path')).toBe(P);
    expect(effectSourceFor(sceneWith({ kind: 'tween', steps: 3, hideSources: true } as PathEffect, ['q', 's']), FX, 'path')).toBeNull();
  });

  it('answers nothing for an effect showing its sources, or a node that is no effect', () => {
    const shown = sceneWith({ kind: 'textAlong' }, ['t', 'p']);
    expect(effectSourceFor(shown, FX, 'items')).toBeNull();
    expect(effectSourceFor(shown, FX, 'path')).toBeNull();
    expect(effectSourceFor(shown, T, 'items')).toBeNull();
    expect(effectSourceFor(shown, asNodeId('missing'), 'path')).toBeNull();
  });
});

describe('effectsShowing', () => {
  it('answers the effects hiding a source in the role it is edited as', () => {
    const scene = sceneWith({ kind: 'textAlong', hideSources: true }, ['t', 'p']);
    expect(effectsShowing(scene, P, 'path')).toEqual([FX]);
    expect(effectsShowing(scene, T, 'items')).toEqual([FX]);
    expect(effectsShowing(scene, T, 'path')).toEqual([]);
    expect(effectsShowing(scene, Q, 'path')).toEqual([]);
  });

  it('answers none for an effect that shows its sources', () => {
    expect(effectsShowing(sceneWith({ kind: 'textAlong' }, ['t', 'p']), P, 'path')).toEqual([]);
  });
});

describe('hiddenSourcesTakenWith', () => {
  const FX2 = asNodeId('fx2');
  function hiding(hide: boolean, extra: readonly object[] = []) {
    const scene = sceneWith({ kind: 'textAlong', hideSources: hide }, ['t', 'p'], extra);
    if (hide) { scene.setHidden(T, true); scene.setHidden(P, true); }
    return scene;
  }

  it('takes the sources an effect with hideSources hid', () => {
    expect(hiddenSourcesTakenWith(hiding(true), [FX])).toEqual([T, P]);
  });

  it('takes none from an effect showing its sources, or one shown again since', () => {
    expect(hiddenSourcesTakenWith(hiding(false), [FX])).toEqual([]);
    const scene = hiding(true);
    scene.setHidden(P, false);
    expect(hiddenSourcesTakenWith(scene, [FX])).toEqual([T]);
  });

  it('leaves a source another effect still reads, and takes it when both go', () => {
    const scene = hiding(true, [{ ...pathEffectNode({ kind: 'bendAlong' }, [Q, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX2 }]);
    expect(hiddenSourcesTakenWith(scene, [FX])).toEqual([T]);
    expect(hiddenSourcesTakenWith(scene, [FX, FX2])).toEqual([T, P]);
  });
});
