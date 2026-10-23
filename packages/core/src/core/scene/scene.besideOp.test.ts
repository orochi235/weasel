import { describe, expect, it } from 'vitest';
import { createTransformOp } from 'core/ops/transform';
import { createScene } from './scene';
import { asNodeId } from './types';

interface Pose { x: number; y: number; width: number; height: number }

const at = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });
const A = asNodeId('a');
const B = asNodeId('b');

/** Two leaves, and an adapter that moves B by as much as it is asked to move A. */
function fixture() {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: at(0) });
  scene.add({ id: B, kind: 'mark', layer: 'main', data: {}, pose: at(100) });
  scene.history.clear();
  const adapter = {
    setPose(id: string, pose: Pose) {
      const dx = pose.x - scene.get(asNodeId(id))!.pose.x;
      scene.setPose(asNodeId(id), pose);
      if (id === A) scene.setPose(B, at(scene.get(B)!.pose.x + dx));
    },
  };
  const move = (from: number, to: number) => createTransformOp<Pose>({ id: A, from: at(from), to: at(to) });
  const xs = (): number[] => [scene.get(A)!.pose.x, scene.get(B)!.pose.x];
  return { scene, adapter, move, xs };
}

describe('Scene — a pose an adapter writes beside the one an op asked for', () => {
  it('is restored by the undo of that op', () => {
    const { scene, adapter, move, xs } = fixture();
    scene.applyBatch([move(0, 5)], 'Move', adapter);
    expect(xs()).toEqual([5, 105]);
    scene.undo();
    expect(xs()).toEqual([0, 100]);
    scene.redo();
    expect(xs()).toEqual([5, 105]);
  });

  it('goes back where the op found it, whatever moved it since', () => {
    const { scene, adapter, move, xs } = fixture();
    scene.applyBatch([move(0, 5), createTransformOp<Pose>({ id: B, from: at(100), to: at(150) })], 'Move', adapter);
    expect(xs()).toEqual([5, 150]);
    scene.undo();
    expect(xs()).toEqual([0, 100]);
    scene.redo();
    expect(xs()).toEqual([5, 150]);
  });

  it('is not worked out again when the op replays', () => {
    const { scene, move } = fixture();
    const C = asNodeId('c');
    const last = { setPose(id: string, pose: Pose) {
      scene.setPose(asNodeId(id), pose);
      scene.setPose(scene.roots.at(-1)!, at(-1));
    } };
    scene.applyBatch([move(0, 5)], 'Move', last);
    scene.untracked(() => scene.add({ id: C, kind: 'mark', layer: 'main', data: {}, pose: at(500) }));
    scene.undo();
    expect(scene.get(C)!.pose.x).toBe(500);
    expect(scene.get(B)!.pose.x).toBe(100);
  });

  it('is serialized as a pose write of its own, and replays once restored with no adapter', () => {
    const { scene, adapter, move, xs } = fixture();
    scene.applyBatch([move(0, 5)], 'Move', adapter);
    const snapshot = JSON.parse(JSON.stringify(scene.serializeHistory()));
    expect(snapshot.undoStack[0].forwardOps).toEqual([
      { name: 'kit:setPose', args: { id: 'a', from: at(0), to: at(5) } },
      { name: 'kit:setPose', args: { id: 'b', from: at(100), to: at(105) } },
    ]);
    scene.restoreHistory(snapshot);
    scene.undo();
    expect(xs()).toEqual([0, 100]);
    scene.redo();
    expect(xs()).toEqual([5, 105]);
  });

  it('is recorded and replayed inside a journal', () => {
    const { scene, adapter, move, xs } = fixture();
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));
    scene.applyBatch([move(0, 5)], 'Move', adapter);
    scene.applyBatch([move(5, 9)], 'Move', adapter);
    journal.undo();
    expect(xs()).toEqual([5, 105]);
    journal.commit('Move');
    scene.undo();
    expect(xs()).toEqual([0, 100]);
    scene.redo();
    expect(xs()).toEqual([5, 105]);
  });
});
