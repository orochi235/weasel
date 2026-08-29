import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import { moveGestureAdapter } from './gestureAdapter';
import { moveAction } from '../defaults/move';
import { createDeleteOp } from 'core/ops/delete';
import type { InvocationCtx } from '../invoker';
import type { Mat3 } from '@weasel-js/geom';

interface D { color: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'container', layer: 'main', data: { color: '#eee' }, pose: { x: 0, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'leaf', layer: 'main', data: { color: '#f00' }, pose: { x: 10, y: 10, width: 20, height: 20 } });
  return { scene, box, leaf };
}

describe('moveGestureAdapter', () => {
  it('reads nodes, poses, and parents from the scene', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    expect(a.getNode(leaf as string)?.id).toBe(leaf);
    expect(a.getPose(leaf as string)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(a.getParent(leaf as string)).toBeNull();
    expect(a.getNodes().map((n) => n.id)).toContain(leaf);
  });

  it('setParent reparents and getParent reflects it', () => {
    const { scene, box, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    a.setParent(leaf as string, box as string);
    expect(scene.get(asNodeId(leaf as string))?.parent).toBe(box);
  });

  it('removeNode then insertNode round-trips a node', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    const node = a.getNode(leaf as string)!;
    a.removeNode(leaf as string);
    expect(scene.get(asNodeId(leaf as string))).toBeUndefined();
    a.insertNode(node);
    expect(scene.get(asNodeId(leaf as string))?.id).toBe(leaf);
  });

  // The move commit's no-`applyOps` fallback is `scene.applyBatch(ops, label,
  // moveGestureAdapter(scene))`. With a geometryProjection wired, that batch
  // includes a `setData` op per moved node — the adapter must apply it, or
  // the batch throws mid-apply and leaves pose and data desynced (pose moved,
  // data stranded — observed live in WeaselDraw).
  it('move commit applies the geometryProjection setData op (no applyOps hook)', () => {
    const { scene, leaf } = fixture();
    const ctx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [leaf as NodeId] },
        scene,
        geometryProjection: {
          transform: (n: { data: unknown }, m: Mat3) => ({
            ...(n.data as D),
            color: `#f00-moved-by-${m[4]},${m[5]}`,
          }),
        },
        // NO applyOps — the commit must fall back to scene.applyBatch.
      },
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
    } as unknown as InvocationCtx;

    const inv = moveAction.invoker;
    if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing invoker');
    const handle = inv.start(ctx, undefined);
    const moved = {
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 3 }, delta: { x: 5, y: 3 } },
    } as unknown as InvocationCtx;
    handle.onMove!(moved);
    handle.onEnd!(moved, 'commit');

    const after = scene.get(asNodeId(leaf as string))!;
    expect(after.pose).toMatchObject({ x: 15, y: 13 });
    expect(after.data.color).toBe('#f00-moved-by-5,3');
  });
});

describe('moveGestureAdapter sibling order', () => {
  it('restores a deleted node to its original slot on undo', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const ids = ['a', 'b', 'c'].map((color) =>
      scene.add({ kind: 'leaf', layer: 'main', data: { color }, pose: { x: 0, y: 0, width: 1, height: 1 } }),
    );
    const a = moveGestureAdapter<P>(scene);
    const middle = a.getNode(ids[1] as string)!;

    scene.applyBatch([createDeleteOp({ node: middle })], 'Delete', a);
    expect(scene.roots).toEqual([ids[0], ids[2]]);

    expect(scene.undo()).toBe(true);
    expect(scene.roots).toEqual(ids);
  });

  it('reads and rewrites root sibling order', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const ids = ['a', 'b', 'c'].map((color) =>
      scene.add({ kind: 'leaf', layer: 'main', data: { color }, pose: { x: 0, y: 0, width: 1, height: 1 } }),
    );
    const a = moveGestureAdapter<P>(scene);
    expect(a.getChildren(null)).toEqual(ids);
    a.setChildOrder(null, [ids[2] as string, ids[0] as string, ids[1] as string]);
    expect(scene.roots).toEqual([ids[2], ids[0], ids[1]]);
  });
});
