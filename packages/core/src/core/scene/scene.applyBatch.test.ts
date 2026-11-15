import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import type { Op } from 'core/ops/types';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

describe('untracked', () => {
  it('refuses applyBatch, which exists to record', () => {
    const s = makeScene();
    expect(() => s.untracked(() => s.applyBatch([], 'x', undefined))).toThrow(/untracked/);
  });
});

describe('applyBatch (no journal)', () => {
  it('records one entry; undo replays inverted ops, redo replays forward ops', () => {
    const s = makeScene();
    const cell = { x: 0 };
    const mk = (from: number, to: number): Op => ({
      apply: () => { cell.x = to; },
      invert: () => mk(to, from),
    });
    s.applyBatch([mk(0, 5)], 'set x', null);
    expect(cell.x).toBe(5);
    expect(s.historyEntries()).toHaveLength(1);
    expect(s.undo()).toBe(true);
    expect(cell.x).toBe(0);
    s.redo();
    expect(cell.x).toBe(5);
  });

  it('ops are applied against the adapter passed at the call site', () => {
    const s = makeScene();
    const seen: unknown[] = [];
    const op: Op = {
      apply: (adapter) => { seen.push(adapter); },
      invert: () => op,
    };
    const adapter = { marker: true };
    s.applyBatch([op], 'probe', adapter);
    expect(seen).toEqual([adapter]);
  });

  it('ops that re-enter scene mutation methods do not double-record', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    const mk = (from: typeof POSE, to: typeof POSE): Op => ({
      apply: (adapter) => { (adapter as typeof s).setPose(id, to); },
      invert: () => mk(to, from),
    });
    // The op mutates via the "adapter" (here: the scene itself, standing in
    // for a SceneCanvasAdapter that forwards to scene.setPose).
    s.applyBatch([mk(POSE, P2)], 'move', s);
    // Exactly two entries: the add and the applyBatch — the inner setPose
    // must not have recorded a third.
    expect(s.historyEntries()).toHaveLength(2);
    expect(s.get(id)?.pose).toEqual(P2);
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    s.redo();
    expect(s.get(id)?.pose).toEqual(P2);
  });

  it('a throwing op mid-batch reverts the ops before it and still notifies', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    let notified = 0;
    s.subscribe(() => { notified++; });
    const P2 = { x: 9, y: 9, width: 10, height: 10 };
    // A wrong inverse on purpose: the rollback must not depend on it.
    const mutate: Op = {
      apply: (adapter) => { (adapter as typeof s).setPose(id, P2); },
      invert: () => mutate,
    };
    const boom: Op = {
      apply: () => { throw new Error('boom'); },
      invert: () => boom,
    };
    const depth = s.historyIndex();
    expect(() => s.applyBatch([mutate, boom], 'partial', s)).toThrow('boom');
    expect(s.get(id)?.pose).toEqual(POSE);
    expect(s.historyIndex()).toBe(depth);
    expect(notified).toBe(1);
  });

  it('applyBatch nested in a batch does not swallow the outer batch dirt', () => {
    const s = makeScene();
    let notified = 0;
    s.subscribe(() => { notified++; });
    const cell = { x: 0 };
    const ext: Op = {
      apply: () => { cell.x = 1; },
      invert: () => ext,
    };
    s.batch('outer', () => {
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
      s.applyBatch([ext], 'inner', null);
    });
    expect(notified).toBe(1);
  });

  it('all-noop batches push no entry', () => {
    const s = makeScene();
    const op: Op = {
      apply: () => 'noop' as const,
      invert: () => op,
    };
    s.applyBatch([op], 'nothing', null);
    expect(s.canUndo()).toBe(false);
  });
});

describe('coalescing (coalesceWindowMs)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function timedScene() {
    return createScene<Data, Layer>({
      systemLayers: [
        { id: 'background' },
        { id: 'structures' },
        { id: 'plantings' },
      ],
      coalesceWindowMs: 500,
    });
  }

  it('applyBatch entries coalesce on matching key multisets, order-independent', () => {
    const s = timedScene();
    const cell = { a: 0, b: 0 };
    const mk = (k: 'a' | 'b', from: number, to: number): Op => ({
      coalesceKey: `set:${k}`,
      apply: () => { cell[k] = to; },
      invert: () => mk(k, to, from),
    });
    s.applyBatch([mk('a', 0, 1), mk('b', 0, 1)], 'drag', null);
    vi.advanceTimersByTime(100);
    s.applyBatch([mk('b', 1, 2), mk('a', 1, 2)], 'drag', null); // reordered — multiset match
    expect(cell).toEqual({ a: 2, b: 2 });
    expect(s.historyEntries()).toHaveLength(1);
    s.undo();
    expect(cell).toEqual({ a: 0, b: 0 });
    s.redo();
    expect(cell).toEqual({ a: 2, b: 2 });
  });
});
