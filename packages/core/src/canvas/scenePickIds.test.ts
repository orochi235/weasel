import { describe, it, expect } from 'vitest';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import { adoptScenePickIds, scenePickIds } from './scenePickIds';

interface Pose { x: number; y: number; width: number; height: number }

const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const rect = (): DrawCommand[] => [{ kind: 'path', path: { kind: 'rect', ...POSE }, fill: { paint: { color: '#000' } } }];

function sceneOf() {
  return createScene<unknown, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
}

describe('scenePickIds', () => {
  it('gives each node a number of its own, kept, and names the node back', () => {
    const scene = sceneOf();
    const ids = scenePickIds(scene);
    const a = ids.idOf('a');
    const b = ids.idOf('b');
    expect(a).toBeGreaterThan(0);
    expect(b).not.toBe(a);
    expect(scenePickIds(scene).idOf('a')).toBe(a);
    expect(ids.nodeOf(b)).toBe('b');
    expect(ids.nodeOf(0)).toBeNull();
    expect(ids.nodeOf(b + 1)).toBeNull();
  });

  it('keeps one scene\'s numbers apart from another\'s', () => {
    const one = scenePickIds(sceneOf());
    one.idOf('x');
    expect(scenePickIds(sceneOf()).nodeOf(one.idOf('x'))).toBeNull();
  });
});

describe('buildSceneTree with a scene adapter', () => {
  it('puts each node\'s pickId on the group that holds its paint', () => {
    const scene = sceneOf();
    const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const [layer] = buildSceneTree(sceneToAdapter(scene) as never, rect as never, VIEW) as GroupDrawCommand[];
    const node = layer.children[0] as GroupDrawCommand;
    expect(node.pickId).toBe(scenePickIds(scene).idOf(id));
    expect(node.children).toEqual(rect());
  });
});

describe('adoptScenePickIds', () => {
  it('names nodes by the numbers given, and mints past them', () => {
    const copy = {};
    adoptScenePickIds(copy, [['b', 2], ['a', 5]]);
    const ids = scenePickIds(copy);
    expect([ids.idOf('a'), ids.idOf('b')]).toEqual([5, 2]);
    expect([ids.nodeOf(5), ids.nodeOf(2), ids.nodeOf(1)]).toEqual(['a', 'b', null]);
    expect(ids.idOf('c')).toBe(6);
  });
});
