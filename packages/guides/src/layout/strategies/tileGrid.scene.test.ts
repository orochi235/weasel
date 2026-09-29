/**
 * `tileGrid` declared on a scene container: the scene places inserts, packs
 * the grid after a delete or resize, and a drag still lands in the cell it
 * picked.
 */
import { describe, expect, it } from 'vitest';
import {
  createScene,
  moveAction,
  type InvocationCtx,
  type LayoutDep,
  type NodeId,
  type OngoingHandle,
  type OngoingInvoker,
  type RectPose,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';

const box = (x: number, y = 0, w = 50, h = 50): RectPose => ({ x, y, width: w, height: h });

function setup() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const G = scene.add({
    kind: 'container', layer: 'main', data: {}, pose: box(0, 0, 150, 50),
    layout: tileGrid<RectPose>({ cols: 3, rows: 1 }),
  });
  const leaf = (pose: RectPose, parent: NodeId | null = G) =>
    scene.add({ kind: 'leaf', layer: 'main', data: {}, pose, parent });
  return { scene, G, leaf };
}

describe('tileGrid as a scene layout', () => {
  it('places an inserted child in the free cell nearest it, as one undo step', () => {
    const { scene, leaf } = setup();
    leaf(box(0));
    const b = leaf(box(400, 400, 5, 5));
    expect(scene.get(b)!.pose).toEqual(box(100));
    scene.undo();
    expect(scene.get(b)).toBeUndefined();
  });

  it('packs the grid again when a child is reordered', () => {
    const { scene, G, leaf } = setup();
    const a = leaf(box(0));
    const b = leaf(box(50));
    scene.reorder(b, 0);
    // childPoses keeps each child's cell order, so a reorder alone moves nothing.
    expect(scene.get(a)!.pose).toEqual(box(0));
    scene.setPose(G, box(0, 0, 300, 50));
    expect(scene.get(b)!.pose).toEqual(box(100, 0, 100, 50));
    scene.undo();
    expect(scene.get(b)!.pose).toEqual(box(50));
  });

  it('closes the gap a deleted child leaves, as one undo step', () => {
    const { scene, leaf } = setup();
    const a = leaf(box(0));
    const b = leaf(box(50));
    scene.remove(a);
    expect(scene.get(b)!.pose).toEqual(box(0));
    scene.undo();
    expect(scene.get(a)!.pose).toEqual(box(0));
    expect(scene.get(b)!.pose).toEqual(box(50));
  });

  it('leaves a dragged child in the free cell it was dropped on', () => {
    const { scene, leaf } = setup();
    leaf(box(0));
    const z = leaf(box(400), null);
    const layout: LayoutDep = { getLayout: (id) => scene.layoutOf(id as NodeId) as never };
    const ctx = (x?: number): InvocationCtx => ({
      world: { x: x ?? 425, y: 25 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => [z] }, scene, layout },
      drag: x === undefined ? undefined : { start: { x: 425, y: 25 }, current: { x, y: 25 }, delta: { x: x - 425, y: 0 } },
    }) as unknown as InvocationCtx;
    const h = (moveAction.invoker as OngoingInvoker).start(ctx(), {}) as OngoingHandle;
    // Over the third cell, with the second one free.
    h.onMove!(ctx(125));
    h.onEnd!(ctx(125), 'commit');
    expect(scene.get(z)!.parent).toBe(scene.roots[0]);
    expect(scene.get(z)!.pose).toEqual(box(100));
  });
});
