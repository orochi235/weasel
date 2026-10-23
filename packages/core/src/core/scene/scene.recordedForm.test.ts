/**
 * What `scene.applyBatch` records, beside a direct scene call: which stack an
 * edit lands on while a journal is open, what coalesces, what a batch inside
 * a batch does, and what an undo replays.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import { createSetDataOp } from 'core/ops/setData';
import { createTransformOp } from 'core/ops/transform';
import { createScene } from './scene';
import { sceneMutators } from './sceneMutators';
import { asNodeId, type Scene } from './types';

interface Pose { x: number; y: number; width: number; height: number }
interface Data { label: string }

const at = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });
const A = asNodeId('a');
const B = asNodeId('b');

/** The scene's writes, and a selection kept on the scene. */
function commitAdapter(scene: Scene<Data, 'main', Pose>) {
  return {
    ...sceneMutators(scene),
    setSelection: (ids: string[]) => { scene.setSelection(ids.map(asNodeId)); },
  };
}

function fixture(options: { coalesceWindowMs?: number } = {}) {
  const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }], ...options });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: { label: 'a' }, pose: at(0) });
  scene.add({ id: B, kind: 'mark', layer: 'main', data: { label: 'b' }, pose: at(100) });
  scene.history.clear();
  const adapter = commitAdapter(scene);
  const move = (id: string, from: number, to: number): Op => createTransformOp<Pose>({ id, from: at(from), to: at(to) });
  const x = (id = A): number => scene.get(id)!.pose.x;
  const labels = (): string[] => scene.historyEntries().map((e) => e.label);
  return { scene, adapter, move, x, labels };
}

/** A hand-rolled op over state the scene does not hold. */
function cellOps() {
  const cell = { value: 0 };
  const set = (from: number, to: number): Op => ({
    apply: () => { cell.value = to; },
    invert: () => set(to, from),
  });
  return { cell, set };
}

describe('Scene — which stack an edit lands on while a journal is open', () => {
  it('an applyBatch goes to the journal; a direct call and scene.history.apply land on the scene stack', () => {
    const { scene, adapter, move, x } = fixture();
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    expect(scene.history.undoDepth()).toBe(0);
    expect(journal.entries().undo).toHaveLength(1);

    scene.setPose(B, at(140));
    expect(scene.history.undoDepth()).toBe(1);
    expect(journal.entries().undo).toHaveLength(1);

    const bound: Op = { apply: () => { scene.setPose(B, at(150)); }, invert: () => bound };
    scene.history.apply(bound, 'Facade');
    expect(scene.history.undoDepth()).toBe(2);
    expect(journal.entries().undo).toHaveLength(1);

    // The journal's commit is one more entry, above the two made beside it.
    journal.commit('Session');
    expect(scene.historyEntries().map((e) => e.label)).toEqual(['setPose', 'Facade', 'Session']);
    scene.undo();
    expect(x()).toBe(0);
    expect(x(B)).toBe(150);
  });

  it('a journal opened on another history reverts in place, and leaves the scene stack alone', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const outside = createHistory(adapter);
    const journal = outside.beginJournal({ label: 'mode' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));
    let notified = 0;
    scene.subscribe(() => { notified++; });

    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    expect(labels()).toEqual([]);
    expect(notified).toBe(1);

    // Nothing of the scene's drives this undo: the kit op it replays still
    // notifies, and records nothing.
    journal.undo();
    expect(x()).toBe(0);
    expect(labels()).toEqual([]);
    expect(notified).toBe(2);

    journal.redo();
    expect(x()).toBe(5);
    expect(labels()).toEqual([]);

    journal.commit('Mode');
    expect(outside.entries().undo.map((e) => e.label)).toEqual(['Mode']);

    outside.undo();
    expect(x()).toBe(0);
    expect(labels()).toEqual([]);
  });

  it('canceling such a journal rewinds the scene and leaves no scene entry', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const journal = createHistory(adapter).beginJournal({ label: 'mode' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    scene.applyBatch([move(A, 5, 9)], 'Move', adapter);
    journal.cancel();
    expect(x()).toBe(0);
    expect(labels()).toEqual([]);
  });
});

describe('Scene — what an applyBatch entry coalesces with', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('merges with the one before it when their ops carry the same keys', () => {
    const { scene, adapter, move, x, labels } = fixture({ coalesceWindowMs: 500 });
    scene.applyBatch([move(A, 0, 1)], 'Nudge', adapter);
    vi.advanceTimersByTime(100);
    scene.applyBatch([move(A, 1, 2)], 'Nudge', adapter);
    expect(labels()).toEqual(['Nudge']);
    scene.undo();
    expect(x()).toBe(0);
    scene.redo();
    expect(x()).toBe(2);
  });

  it('never merges when an op has no key, though the scene call it makes has one', () => {
    const { scene, adapter, labels } = fixture({ coalesceWindowMs: 500 });
    const rename = (from: string, to: string): Op =>
      createSetDataOp<Data>({ id: A, from: { label: from }, to: { label: to } });
    scene.applyBatch([rename('a', 'b')], 'Rename', adapter);
    vi.advanceTimersByTime(100);
    scene.applyBatch([rename('b', 'c')], 'Rename', adapter);
    expect(labels()).toEqual(['Rename', 'Rename']);

    // The same two writes made directly do merge.
    scene.update(A, { data: { label: 'd' } });
    vi.advanceTimersByTime(100);
    scene.update(A, { data: { label: 'e' } });
    expect(labels()).toEqual(['Rename', 'Rename', 'update']);
  });

  it('does not merge with a direct call on the same node, either way round', () => {
    const { scene, adapter, move, labels } = fixture({ coalesceWindowMs: 500 });
    scene.setPose(A, at(1));
    vi.advanceTimersByTime(100);
    scene.applyBatch([move(A, 1, 2)], 'Nudge', adapter);
    vi.advanceTimersByTime(100);
    scene.setPose(A, at(3));
    expect(labels()).toEqual(['setPose', 'Nudge', 'setPose']);
  });

  it('pushes no entry when every op reports that it changed nothing', () => {
    const { scene, adapter, move, labels } = fixture();
    scene.applyBatch([move(A, 0, 0)], 'Nudge', adapter);
    expect(labels()).toEqual([]);
  });
});

describe('Scene — applyBatch inside scene.batch', () => {
  // As of 2026-10-12. "One recorded form for a scene edit" makes this one entry.
  it('joins the entry of the batch it is in', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const { cell, set } = cellOps();
    scene.batch('outer', () => {
      scene.setPose(A, at(5));
      scene.applyBatch([move(B, 100, 140), set(0, 7)], 'inner', adapter);
    });
    expect(labels()).toEqual(['outer']);
    scene.undo();
    expect([x(), x(B), cell.value]).toEqual([0, 100, 0]);
    scene.redo();
    expect([x(), x(B), cell.value]).toEqual([5, 140, 7]);
  });

  it('takes back its own ops when one throws, and leaves the batch to go on', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const { cell, set } = cellOps();
    const boom: Op = { apply: () => { throw new Error('boom'); }, invert: () => boom };
    scene.batch('outer', () => {
      scene.setPose(A, at(5));
      expect(() => scene.applyBatch([set(0, 7), move(B, 100, 140), boom], 'inner', adapter)).toThrow('boom');
    });
    expect([x(), x(B), cell.value]).toEqual([5, 100, 0]);
    expect(labels()).toEqual(['outer']);
    scene.undo();
    expect(x()).toBe(0);
  });

  it('has its hand-rolled op taken back when the batch throws after it', () => {
    const { scene, adapter } = fixture();
    const { cell, set } = cellOps();
    expect(() => scene.batch('outer', () => {
      scene.applyBatch([set(0, 7)], 'inner', adapter);
      throw new Error('later');
    })).toThrow('later');
    expect(cell.value).toBe(0);
  });
});

describe('Scene — an applyBatch whose op throws', () => {
  it('takes back the scene edit and the hand-rolled op before it, and records nothing', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const { cell, set } = cellOps();
    const boom: Op = { apply: () => { throw new Error('boom'); }, invert: () => boom };
    expect(() => scene.applyBatch([set(0, 7), move(A, 0, 5), boom], 'Partial', adapter)).toThrow('boom');
    expect(cell.value).toBe(0);
    expect(x()).toBe(0);
    expect(labels()).toEqual([]);
    expect(scene.canRedo()).toBe(false);
  });
});

describe('Scene — undo and redo of an applyBatch', () => {
  it('restores a scene edit and the selection change made beside it', () => {
    const { scene, adapter, move, x, labels } = fixture();
    scene.applyBatch([move(A, 0, 5), createSetSelectionOp({ from: [], to: [A] })], 'Move', adapter);
    expect(labels()).toEqual(['Move']);
    expect(scene.getSelection()).toEqual([A]);
    scene.undo();
    expect(x()).toBe(0);
    expect(scene.getSelection()).toEqual([]);
    scene.redo();
    expect(x()).toBe(5);
    expect(scene.getSelection()).toEqual([A]);
  });

  it('restores a selection the adapter keeps somewhere other than the scene', () => {
    const { scene, move, x } = fixture();
    let selected: string[] = [];
    const adapter = { ...commitAdapter(scene), setSelection: (ids: string[]) => { selected = ids; } };
    scene.applyBatch([move(A, 0, 5), createSetSelectionOp({ from: [], to: [A] })], 'Move', adapter);
    expect(selected).toEqual([A]);
    scene.undo();
    expect(x()).toBe(0);
    expect(selected).toEqual([]);
    scene.redo();
    expect(selected).toEqual([A]);
  });

  it('restores a hand-rolled op and the scene edit made beside it, as one step', () => {
    const { scene, adapter, move, x, labels } = fixture();
    const { cell, set } = cellOps();
    scene.applyBatch([set(0, 7), move(A, 0, 5)], 'Both', adapter);
    expect(labels()).toEqual(['Both']);
    scene.undo();
    expect([cell.value, x()]).toEqual([0, 0]);
    scene.redo();
    expect([cell.value, x()]).toEqual([7, 5]);
  });

  it('replays the scene writes the batch made, not the adapter it was applied with', () => {
    const { scene, move, x } = fixture();
    const base = commitAdapter(scene);
    const writes: number[] = [];
    const adapter = {
      ...base,
      setPose(id: string, pose: Pose) {
        writes.push(pose.x);
        base.setPose(id, pose);
      },
    };
    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    scene.undo();
    scene.redo();
    expect(x()).toBe(5);
    expect(writes).toEqual([5]);
  });
});

describe('Scene — what an applyBatch entry holds', () => {
  it('names the node a delete took in touchedIds', () => {
    const { scene, adapter } = fixture();
    scene.applyBatch([createDeleteOp({ node: scene.get(A)! })], 'Delete', adapter);
    expect([...(scene.history.entries().undo[0]!.touchedIds ?? [])]).toEqual([A]);
  });

  it('serializes the scene writes its ops made, as a direct call does', () => {
    const { scene, adapter, move } = fixture();
    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    scene.setPose(B, at(140));
    const snapshot = scene.serializeHistory();
    expect(snapshot.undoStack.map((e) => e.forwardOps.map((op) => op.name))).toEqual([['kit:setPose'], ['kit:setPose']]);
    expect(snapshot.form).toBe(3);
  });

  it('serializes an op that wrote no scene state as itself', () => {
    const { scene, adapter, move } = fixture();
    scene.applyBatch([move(A, 0, 5), createSetSelectionOp({ from: [], to: [A] })], 'Move', adapter);
    const [entry] = scene.serializeHistory().undoStack;
    expect(entry!.forwardOps.map((op) => op.name)).toEqual(['kit:setPose', 'setSelection']);
  });

  it('is not restored from a snapshot in another form', () => {
    const { scene, adapter, move, labels } = fixture();
    scene.applyBatch([move(A, 0, 5)], 'Move', adapter);
    const { form: _form, ...old } = scene.serializeHistory();
    scene.history.clear();
    scene.restoreHistory(old);
    expect(labels()).toEqual([]);
  });
});
