/**
 * Alt-drag clone of a container, on a real scene with the default absolute
 * poses: every node stores world coordinates.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import { cloneAction } from './action';

const G = asNodeId('g');
const A = asNodeId('a');
const B = asNodeId('b');
const ORIGINALS = new Set<NodeId>([G, A, B]);

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<{ tag: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: G, kind: 'group', layer: 'main', data: { tag: 'g' }, pose: { x: 0, y: 0, width: 60, height: 20 }, dependsOn: 'children' });
  scene.add({ id: A, kind: 'mark', layer: 'main', parent: G, data: { tag: 'a' }, pose: { x: 0, y: 0, width: 20, height: 20 } });
  scene.add({ id: B, kind: 'mark', layer: 'main', parent: G, data: { tag: 'b' }, pose: { x: 40, y: 0, width: 20, height: 20 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function ctxAt(scene: Scene<unknown, string, unknown>, selected: NodeId[], dx: number): InvocationCtx {
  return {
    world: { x: dx, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: true, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => selected, set: () => {} }, scene },
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 } },
  } as unknown as InvocationCtx;
}

function begin(scene: Scene<unknown, string, unknown>, selected: NodeId[]) {
  const invoker = cloneAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  return invoker.start(ctxAt(scene, selected, 0), undefined);
}

function cloneBy(scene: Scene<unknown, string, unknown>, selected: NodeId[], dx: number) {
  const handle = begin(scene, selected);
  handle.onMove!(ctxAt(scene, selected, dx));
  handle.onEnd!(ctxAt(scene, selected, dx), 'commit');
}

function copiesIn(scene: Scene<unknown, string, unknown>): NodeId[] {
  return [...scene.renderOrder()].filter((id) => !ORIGINALS.has(id));
}

describe('cloneAction on a container', () => {
  it('copies the children under the copied container, each moved by the drag', () => {
    const scene = makeScene();
    cloneBy(scene, [G], 100);

    const newRoots = scene.roots.filter((id) => id !== G);
    expect(newRoots).toHaveLength(1);
    const copy = scene.get(newRoots[0])!;
    expect(copy.kind).toBe('group');
    expect(copy.dependsOn).toBe('children');

    const kids = scene.childrenOf(newRoots[0]).map((id) => scene.get(id)!);
    expect(kids.map((k) => k.data)).toEqual([{ tag: 'a' }, { tag: 'b' }]);
    expect(kids.map((k) => k.pose)).toEqual([
      { x: 100, y: 0, width: 20, height: 20 },
      { x: 140, y: 0, width: 20, height: 20 },
    ]);
    // The originals stay put.
    expect(scene.get(A)!.pose).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(scene.childrenOf(G)).toEqual([A, B]);
  });

  it('copies a child once when its container is selected with it', () => {
    const scene = makeScene();
    cloneBy(scene, [G, A], 100);
    // One container and its two children, with no second copy of `a`.
    expect(copiesIn(scene)).toHaveLength(3);
    expect(scene.childrenOf(G)).toEqual([A, B]);
  });

  it('previews the children it will copy', () => {
    const scene = makeScene();
    const handle = begin(scene, [G]);
    handle.onMove!(ctxAt(scene, [G], 100));
    expect([...(handle.previewIds!() ?? [])].sort()).toEqual([A, B, G].sort());
    expect(handle.previewPose!(B as string)).toEqual({ x: 140, y: 0, width: 20, height: 20 });
  });

  it('undoes as one step', () => {
    const scene = makeScene();
    cloneBy(scene, [G], 100);
    scene.undo();
    expect(copiesIn(scene)).toHaveLength(0);
  });
});
