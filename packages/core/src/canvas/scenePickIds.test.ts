import { describe, it, expect } from 'vitest';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { documentOf } from 'core/scene/documentOf';
import { createEditingSession } from 'core/scene/editingSession';
import type { View } from 'core/viewport/view';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import { adoptScenePickIds, createScenePickIds, scenePickIds } from './scenePickIds';

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
    const aId = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const bId = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const a = ids.pickIdOf(aId);
    const b = ids.pickIdOf(bId);
    expect(a).toBeGreaterThan(0);
    expect(b).not.toBe(a);
    expect(scenePickIds(scene).pickIdOf(aId)).toBe(a);
    expect(ids.idOfPickId(b)).toBe(bId);
    expect(ids.idOfPickId(0)).toBeNull();
    expect(ids.idOfPickId(b + 1)).toBeNull();
  });

  it('stops naming a node once it leaves the scene, and names it again if it comes back', () => {
    const scene = sceneOf();
    const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const ids = scenePickIds(scene);
    const n = ids.pickIdOf(id);
    scene.remove(id);
    expect(ids.idOfPickId(n)).toBeNull();
    scene.undo();
    expect(ids.pickIdOf(id)).toBe(n);
    expect(ids.idOfPickId(n)).toBe(id);
  });

  it('keeps one scene\'s numbers apart from another\'s', () => {
    const one = scenePickIds(sceneOf());
    one.pickIdOf('x');
    expect(scenePickIds(sceneOf()).idOfPickId(one.pickIdOf('x'))).toBeNull();
  });
});

describe('createScenePickIds once every number is given', () => {
  it('hands out removed nodes\' numbers, lowest first, and only then', () => {
    const live = new Set(['a', 'b', 'c']);
    const ids = createScenePickIds((id) => live.has(id), 3);
    expect(['a', 'b', 'c'].map(ids.pickIdOf)).toEqual([1, 2, 3]);
    live.delete('c');
    live.delete('a');
    live.add('d').add('e');
    expect([ids.pickIdOf('d'), ids.pickIdOf('e')]).toEqual([1, 3]);
    expect([ids.idOfPickId(1), ids.idOfPickId(2), ids.idOfPickId(3)]).toEqual(['d', 'b', 'e']);
    expect(ids.pickIdOf('b')).toBe(2);
  });

  it('throws when every number is held by a node still in the scene', () => {
    const ids = createScenePickIds(() => true, 2);
    ids.pickIdOf('a');
    ids.pickIdOf('b');
    expect(() => ids.pickIdOf('c')).toThrow(RangeError);
  });

  it('gives a node that left and came back a new number once its old one went to another', () => {
    const live = new Set(['a']);
    const ids = createScenePickIds((id) => live.has(id), 1);
    ids.pickIdOf('a');
    live.delete('a');
    live.add('b');
    expect(ids.pickIdOf('b')).toBe(1);
    live.delete('b');
    live.add('a');
    expect(ids.pickIdOf('a')).toBe(1);
    expect(ids.idOfPickId(1)).toBe('a');
  });

  it('numbers a document reading and an editing session as their scene does', () => {
    const scene = sceneOf();
    const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const n = scenePickIds(createEditingSession(scene)).pickIdOf(id);
    expect(scenePickIds(scene).pickIdOf(id)).toBe(n);
    expect(scenePickIds(documentOf(scene)).idOfPickId(n)).toBe(id);
  });
});

describe('buildSceneTree with a scene adapter', () => {
  it('puts each node\'s pickId on the group that holds its paint', () => {
    const scene = sceneOf();
    const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: {} });
    const [layer] = buildSceneTree(sceneToAdapter(scene) as never, rect as never, VIEW) as GroupDrawCommand[];
    const node = layer.children[0] as GroupDrawCommand;
    expect(node.pickId).toBe(scenePickIds(scene).pickIdOf(id));
    expect(node.children).toEqual(rect());
  });
});

describe('adoptScenePickIds', () => {
  it('names nodes by the numbers given, and mints past them', () => {
    const copy = {};
    adoptScenePickIds(copy, [['b', 2], ['a', 5]]);
    const ids = scenePickIds(copy);
    expect([ids.pickIdOf('a'), ids.pickIdOf('b')]).toEqual([5, 2]);
    expect([ids.idOfPickId(5), ids.idOfPickId(2), ids.idOfPickId(1)]).toEqual(['a', 'b', null]);
    expect(ids.pickIdOf('c')).toBe(6);
  });
});
