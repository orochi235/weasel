import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathContainsPoint, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { CLIP_NOTHING, clipNothing } from 'core/scene/clipNothing';
import { asNodeId } from 'core/scene/types';
import type { RectPose } from 'core/scene/composePose';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { overChildren } from './overChildren';
import { pickWalk, scenePickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';

type Data = { path?: Path; fill?: null };
const BOX: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const FAR: RectPose = { x: 50, y: 50, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const OUTLINE: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const FAR_OUTLINE: Path = { kind: 'rect', x: 50, y: 50, width: 10, height: 10 };

type Group = { kind: 'group'; clip?: Path; children: DrawCommand[] };

function sceneOf(parent: { kind: 'mark' | 'group'; clip?: 'outline' }) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const p = scene.add({ id: asNodeId('p'), layer: 'main', pose: BOX, data: { path: OUTLINE, fill: null }, ...parent });
  scene.add({ id: asNodeId('kid'), kind: 'mark', layer: 'main', pose: FAR, data: { path: OUTLINE }, parent: p });
  return scene;
}

/** The clip the draw walk wraps the child's paint in, or undefined. */
function childClip(scene: ReturnType<typeof sceneOf>): Path | undefined {
  const draw = (): DrawCommand[] => [{ kind: 'path', path: OUTLINE, fill: { paint: { color: '#000' } } }];
  const [layer] = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW) as Group[];
  return (layer!.children[1] as Group).clip;
}

function pickAt(scene: ReturnType<typeof sceneOf>, x: number, y: number): string[] {
  return pickWalk<RectPose>(scenePickSource(scene), {
    hits: (_n, p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height,
    clipAdmits: (clip) => pathContainsPoint(clip, x, y),
  });
}

describe('a node clips its children only when it declares a clip', () => {
  it('a mark with children and no clip draws and picks a child outside its box', () => {
    const scene = sceneOf({ kind: 'mark' });
    expect(childClip(scene)).toBeUndefined();
    expect(pickAt(scene, 55, 55)).toEqual(['kid']);
  });

  it('a group holding an outline but declaring no clip clips nothing', () => {
    const scene = sceneOf({ kind: 'group' });
    expect(childClip(scene)).toBeUndefined();
    expect(pickAt(scene, 55, 55)).toEqual(['kid']);
  });

  it.each(['mark', 'group'] as const)('a %s with `clip: "outline"` clips its children to its outline', (kind) => {
    const scene = sceneOf({ kind, clip: 'outline' });
    const clip = childClip(scene);
    expect(clip && boundsOfPath(clip)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
    expect(pickAt(scene, 55, 55)).toEqual([]);
  });

  it('leaves the own paint of a clipping mark, stroke and all, outside its clip', () => {
    const scene = sceneOf({ kind: 'mark', clip: 'outline' });
    const draw = (): DrawCommand[] => [{ kind: 'path', path: OUTLINE, stroke: { paint: { color: '#000' }, width: 4 } }];
    const [layer] = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW) as Group[];
    const [own, kid] = layer!.children as Group[];
    expect(own!.clip).toBeUndefined();
    expect(own!.children).toEqual([{ kind: 'path', path: OUTLINE, stroke: { paint: { color: '#000' }, width: 4 } }]);
    expect(kid!.clip).toBeDefined();
  });

  it('leaves what a clipping mark paints over its children outside its clip too', () => {
    const scene = sceneOf({ kind: 'mark', clip: 'outline' });
    const label: DrawCommand = { kind: 'path', path: FAR_OUTLINE, fill: { paint: { color: '#f00' } } };
    const draw = (n: { id: string }): DrawCommand[] => (n.id === 'p' ? [overChildren([label])] : []);
    const [layer] = buildSceneTree(sceneToAdapter(scene) as never, draw as never, VIEW) as Group[];
    const over = layer!.children.at(-1) as Group;
    expect(over.clip).toBeUndefined();
    expect(over.children).toEqual([label]);
  });

  it('clips the child of a mark only the rect fallback draws to its box', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const p = scene.add({ id: asNodeId('p'), kind: 'mark', layer: 'main', pose: BOX, data: {}, clip: 'outline' });
    scene.add({ id: asNodeId('kid'), kind: 'mark', layer: 'main', pose: FAR, data: { path: OUTLINE }, parent: p });
    expect(childClip(scene)).toEqual({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    expect(pickAt(scene, 55, 55)).toEqual([]);
  });

  it('round-trips the declared clip through a snapshot', () => {
    const json = sceneOf({ kind: 'group', clip: 'outline' }).toJSON();
    expect(json.nodes.find((n) => n.id === 'p')).toMatchObject({ clip: 'outline' });
    expect(json.nodes.find((n) => n.id === 'kid')).not.toHaveProperty('clip');
    expect(sceneFromJSON(json).get(asNodeId('p'))?.clip).toBe('outline');
  });

  it('carries the declared clip through remove and undo', () => {
    const scene = sceneOf({ kind: 'group', clip: 'outline' });
    scene.remove(asNodeId('p'));
    scene.undo();
    expect(scene.get(asNodeId('p'))?.clip).toBe('outline');
  });
});

describe('a version 1 save draws as version 1 drew it', () => {
  const v1 = (nodes: object[]) => ({ version: 1 as const, systemLayers: [{ id: 'main' }], nodes });
  const OUTLINED = { path: OUTLINE, fill: null };
  /** A container `c` holding a leaf beside it, as version 1 saved one. */
  const saved = (data: object, extra: object = {}) => v1([
    { id: 'p', kind: 'container', layer: 'main', pose: BOX, data, ...extra },
    { id: 'kid', kind: 'leaf', layer: 'main', pose: FAR, data: { path: OUTLINE }, parent: 'p' },
  ]) as never;

  it('clips a container\'s children to the outline its painter draws', () => {
    const clip = childClip(sceneFromJSON(saved(OUTLINED)) as never);
    expect(clip && boundsOfPath(clip)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('leaves them unclipped under a container no painter claimed', () => {
    expect(childClip(sceneFromJSON(saved({})) as never)).toBeUndefined();
  });

  it('gives a container a classifier makes a mark no implicit clip', () => {
    const scene = sceneFromJSON(saved(OUTLINED), { classifyV1: () => 'mark' });
    expect(scene.get(asNodeId('p'))?.clip).toBeUndefined();
    expect(childClip(scene as never)).toBeUndefined();
  });

  it('loads a container naming `clipNothing` with that function, clipping nothing', () => {
    const scene = sceneFromJSON(saved(OUTLINED, { clipFromPoseKey: CLIP_NOTHING }));
    expect(scene.get(asNodeId('p'))?.clipFromPose).toBe(clipNothing);
    expect(childClip(scene as never)).toBeUndefined();
  });

  it('reports a clip key it skips, and clips as version 1 did without one', () => {
    const skipped: unknown[] = [];
    const scene = sceneFromJSON(saved(OUTLINED, { clipFromPoseKey: 'gone' }), {
      unknownKeys: 'skip', onSkip: (s) => skipped.push(s),
    });
    expect(skipped).toEqual([{ id: 'p', field: 'clipFromPose', key: 'gone' }]);
    const clip = childClip(scene as never);
    expect(clip && boundsOfPath(clip)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
    const asMark = sceneFromJSON(saved(OUTLINED, { clipFromPoseKey: 'gone' }), {
      unknownKeys: 'skip', classifyV1: () => 'mark',
    });
    expect(asMark.get(asNodeId('p'))?.clip).toBeUndefined();
  });
});

describe('loading with unknown registry keys', () => {
  const v2 = {
    version: 2 as const, systemLayers: [{ id: 'main' }],
    nodes: [{ id: 'g', kind: 'group' as const, layer: 'main', pose: BOX, data: {}, layoutKey: 'gone' }],
  };

  it('throws by default', () => {
    expect(() => sceneFromJSON(v2 as never)).toThrow(/unknown layout key 'gone'/);
  });

  it('skips and reports one in loadState when asked', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const skipped: unknown[] = [];
    scene.loadState(v2 as never, { unknownKeys: 'skip', onSkip: (s) => skipped.push(s) });
    expect(scene.get(asNodeId('g'))?.layout).toBeUndefined();
    expect(skipped).toEqual([{ id: 'g', field: 'layout', key: 'gone' }]);
  });
});
