/**
 * Undo and redo of a batch applied through the cascading canvas adapter. A
 * cascade moves descendants as a side effect of posing their container, so a
 * batch that also poses those descendants itself is the case that tells an
 * exact undo from one that cascades a second time on the way back.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { createReparentOp } from 'core/ops/reparent';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { sceneToAdapter } from './sceneAdapter';

interface Pose { x: number; y: number; width: number; height: number }

const at = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });

/** A holds B, B holds C, and C holds a leaf no batch here names. */
function fixture(coalesceWindowMs?: number) {
  const scene = createScene<object, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    ...(coalesceWindowMs === undefined ? {} : { coalesceWindowMs }),
  });
  const add = (kind: 'mark' | 'group', x: number, parent?: NodeId): NodeId =>
    scene.add({ kind, layer: 'main', data: {}, pose: at(x), ...(parent ? { parent } : {}) });
  const a = add('group', 0);
  const b = add('group', 100, a);
  const c = add('group', 200, b);
  const leaf = add('mark', 300, c);
  const adapter = sceneToAdapter(scene);
  const xs = (): number[] => [a, b, c, leaf].map((id) => scene.get(id)!.pose.x);
  const move = (id: NodeId, from: number, to: number): Op =>
    createTransformOp<Pose>({ id, from: at(from), to: at(to), label: 'Move' });
  return { scene, adapter, a, b, c, leaf, xs, move };
}

describe('sceneToAdapter cascade — undo of a batch', () => {
  it('undoes and redoes a batch that poses a container and its descendants', () => {
    const { scene, adapter, a, b, c, xs, move } = fixture();
    adapter.applyOps([move(a, 0, 5), move(b, 100, 105), move(c, 200, 205)], 'Move');
    expect(xs()).toEqual([5, 105, 205, 305]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 105, 205, 305]);
  });

  it('does the same when the batch names the descendants first', () => {
    const { scene, adapter, a, b, c, xs, move } = fixture();
    adapter.applyOps([move(c, 200, 205), move(b, 100, 105), move(a, 0, 5)], 'Move');
    const applied = xs();
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual(applied);
  });

  it('does the same when a descendant moves farther than its container', () => {
    const { scene, adapter, a, b, xs, move } = fixture();
    adapter.applyOps([move(a, 0, 5), move(b, 100, 110)], 'Move');
    expect(xs()).toEqual([5, 110, 210, 310]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 110, 210, 310]);
  });

  it('still undoes a batch that poses the container alone', () => {
    const { scene, adapter, a, xs, move } = fixture();
    adapter.applyOps([move(a, 0, 5)], 'Move');
    expect(xs()).toEqual([5, 105, 205, 305]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 105, 205, 305]);
  });

  it('undoes an op that poses a descendant and then its container', () => {
    const { scene, adapter, a, b, xs } = fixture();
    const both = (bx: number, ax: number): Op => ({
      apply(target) {
        const t = target as { setPose(id: string, pose: Pose): void };
        t.setPose(b, at(bx));
        t.setPose(a, at(ax));
      },
      invert: () => both(100, 0),
    });
    adapter.applyOps([both(110, 5)], 'Both');
    expect(xs()).toEqual([5, 115, 215, 315]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 115, 215, 315]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
  });

  it('undoes a reparent out of a container the batch also moves', () => {
    const { scene, adapter, a, c, leaf, xs, move } = fixture();
    adapter.applyOps(
      [move(a, 0, 5), createReparentOp({ id: leaf, fromParentId: c, toParentId: null }), move(a, 5, 9)],
      'Move',
    );
    expect(xs()).toEqual([9, 109, 209, 305]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    expect(scene.get(leaf)!.parent).toBe(c);
    scene.redo();
    expect(xs()).toEqual([9, 109, 209, 305]);
  });

  it('undoes two coalesced batches to before the first, and redoes to after the second', () => {
    const { scene, adapter, a, b, xs, move } = fixture(60_000);
    adapter.applyOps([move(a, 0, 5), move(b, 100, 105)], 'Move');
    adapter.applyOps([move(a, 5, 9), move(b, 105, 109)], 'Move');
    expect(xs()).toEqual([9, 109, 209, 309]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([9, 109, 209, 309]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
  });
});

describe('sceneToAdapter cascade — undo outside adapter.applyOps', () => {
  it('undoes and redoes a batch handed straight to scene.applyBatch', () => {
    const { scene, adapter, a, b, c, xs, move } = fixture();
    scene.applyBatch([move(a, 0, 5), move(b, 100, 105), move(c, 200, 205)], 'Move', adapter);
    expect(xs()).toEqual([5, 105, 205, 305]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 105, 205, 305]);
  });

  it('undoes and redoes the batch after its history is serialized and restored', () => {
    const { scene, adapter, a, b, c, xs, move } = fixture();
    adapter.applyOps([move(a, 0, 5), move(b, 100, 105), move(c, 200, 205)], 'Move');
    scene.setHistoryAdapter(() => adapter);
    scene.restoreHistory(JSON.parse(JSON.stringify(scene.serializeHistory())));
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
    scene.redo();
    expect(xs()).toEqual([5, 105, 205, 305]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
  });

  it('redoes a restored batch that was undone before it was serialized', () => {
    const { scene, adapter, a, b, xs, move } = fixture();
    adapter.applyOps([move(a, 0, 5), move(b, 100, 110)], 'Move');
    scene.undo();
    scene.setHistoryAdapter(() => adapter);
    scene.restoreHistory(JSON.parse(JSON.stringify(scene.serializeHistory())));
    scene.redo();
    expect(xs()).toEqual([5, 110, 210, 310]);
    scene.undo();
    expect(xs()).toEqual([0, 100, 200, 300]);
  });

  it('serializes a container move as every pose write the cascade made', () => {
    const { scene, adapter, c, leaf, move } = fixture();
    adapter.applyOps([move(c, 200, 205)], 'Move');
    const ops = scene.serializeHistory().undoStack.at(-1)!.forwardOps;
    expect(ops.map((op) => [op.name, (op.args as { id: string }).id])).toEqual([['kit:setPose', c], ['kit:setPose', leaf]]);
  });
});
