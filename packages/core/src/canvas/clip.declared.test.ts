import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathContainsPoint, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { CLIP_NOTHING, clipNothing } from 'core/scene/clipNothing';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { RectPose } from 'core/scene/composePose';
import type { View } from 'core/viewport/view';
import { buildSceneTree } from './buildSceneTree';
import { pickWalk, scenePickSource } from './pickWalk';
import { sceneToAdapter } from './sceneAdapter';

type Data = { path?: Path; fill?: null };
const BOX: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const FAR: RectPose = { x: 50, y: 50, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const OUTLINE: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };

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

describe('a version 1 save', () => {
  const v1 = (nodes: object[]) => ({ version: 1 as const, systemLayers: [{ id: 'main' }], nodes });
  const node = (id: string, kind: 'leaf' | 'container', extra: object = {}) => (
    { id, kind, layer: 'main', pose: BOX, data: {}, ...extra }
  );

  it('loads a container without a clip key as clipping to its outline, as version 1 drew it', () => {
    const scene = sceneFromJSON(v1([node('c', 'container'), node('l', 'leaf', { parent: 'c' })]) as never);
    expect(scene.get(asNodeId('c'))?.clip).toBe('outline');
    expect(scene.get(asNodeId('l'))?.clip).toBeUndefined();
  });

  it('keeps that clip when a classifier makes the container a mark', () => {
    const scene = sceneFromJSON(v1([node('c', 'container')]) as never, { classifyV1: () => 'mark' });
    expect(scene.get(asNodeId('c'))).toMatchObject({ kind: 'mark', clip: 'outline' });
  });

  it('loads a container naming `clipNothing` with that function and no declared clip', () => {
    const scene = sceneFromJSON(v1([node('c', 'container', { clipFromPoseKey: CLIP_NOTHING })]) as never);
    const c = scene.get(asNodeId('c' as NodeId));
    expect(c?.clipFromPose).toBe(clipNothing);
    expect(c?.clip).toBeUndefined();
  });
});
