import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import type { Op } from 'core/ops/types';
import { registerOpFactory } from 'core/ops/registry';
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

describe('history persistence (serializeHistory / restoreHistory)', () => {
  /** Serialize scene A's state+history, rebuild both into a fresh scene. */
  function roundTrip(a: ReturnType<typeof makeScene>) {
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    return b;
  }

  it('external-op entries replay through the lazy history adapter (wired after restore)', () => {
    const NAME = 'scenetest:cellSet';
    let cell = 0;
    const mk = (f: number, t: number): Op => ({
      name: NAME, args: { from: f, to: t },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
      invert: () => mk(t, f),
    });
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      return mk(from, to);
    });
    const liveAdapter = { set: (v: number) => { cell = v; } };
    const a = makeScene();
    a.applyBatch([mk(0, 7)], 'set cell', liveAdapter);
    expect(cell).toBe(7);

    const b = roundTrip(a);
    // Adapter wired AFTER restore — lazy binding must not care.
    b.setHistoryAdapter(() => liveAdapter);
    b.undo();
    expect(cell).toBe(0);
    b.redo();
    expect(cell).toBe(7);
  });

  it('external-op entries replay through the lazy history adapter (wired before restore)', () => {
    const NAME = 'scenetest:cellSetPre';
    let cell = 0;
    const mk = (f: number, t: number): Op => ({
      name: NAME, args: { from: f, to: t },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
      invert: () => mk(t, f),
    });
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      return mk(from, to);
    });
    const liveAdapter = { set: (v: number) => { cell = v; } };
    const a = makeScene();
    a.applyBatch([mk(0, 7)], 'set cell', liveAdapter);
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    b.setHistoryAdapter(() => liveAdapter); // wired BEFORE restore
    b.restoreHistory(snap);
    b.undo();
    expect(cell).toBe(0);
    b.redo();
    expect(cell).toBe(7);
  });

  it('restored external ops with no history adapter are warning no-ops, never throws', () => {
    const NAME = 'scenetest:noAdapter';
    let cell = 0;
    registerOpFactory(NAME, (args) => {
      const { to } = args as { to: number };
      const mk = (t: number): Op => ({
        name: NAME, args: { to: t },
        apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
        invert: () => mk(0),
      });
      return mk(to);
    });
    const a = makeScene();
    a.applyBatch([{
      name: NAME, args: { to: 9 },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(9); },
      invert: () => ({ name: NAME, args: { to: 0 }, apply: () => { cell = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set', { set: (v: number) => { cell = v; } });
    const b = roundTrip(a);
    expect(() => b.undo()).not.toThrow(); // no adapter wired: no-op with a debug warning
    expect(cell).toBe(9);
  });

  it('restored external ops whose apply throws against the wired adapter degrade to no-ops', () => {
    const NAME = 'scenetest:adapterGap';
    let cell = 0;
    const mk = (t: number): Op => ({
      name: NAME, args: { to: t },
      // Rebuilt op calls a method the wired adapter may not have — mirrors a
      // live-adapter/history-adapter surface mismatch (e.g. setData).
      apply: (adapter) => { (adapter as { missing(v: number): void }).missing(t); },
      invert: () => mk(0),
    });
    registerOpFactory(NAME, (args) => mk((args as { to: number }).to));
    const a = makeScene();
    a.applyBatch([{
      name: NAME, args: { to: 9 },
      apply: (adapter) => { (adapter as { missing(v: number): void }).missing(9); },
      invert: () => ({ name: NAME, args: { to: 0 }, apply: () => { cell = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set', { missing: (v: number) => { cell = v; } });
    expect(cell).toBe(9);
    const b = roundTrip(a);
    b.setHistoryAdapter(() => ({})); // wired adapter lacks `missing`
    expect(() => b.undo()).not.toThrow(); // throw degrades to a warned no-op
    expect(b.canRedo()).toBe(true);       // entry still lands on the redo stack
    expect(cell).toBe(9);                 // state untouched by the failed replay
  });
});
