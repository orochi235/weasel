import { describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { POSE, makeScene, type Data, type Layer } from './testing/makeScene';

describe('history persistence (serializeHistory / restoreHistory)', () => {
  /** Serialize scene A's state+history, rebuild both into a fresh scene. */
  function roundTrip(a: ReturnType<typeof makeScene>) {
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    return b;
  }

  it('native-op entries undo/redo after a round-trip', () => {
    const a = makeScene();
    const id = a.add({ id: asNodeId('n1'), kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'x' } });
    a.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    const b = roundTrip(a);
    expect(b.historyEntries()).toHaveLength(2);
    expect(b.undo()).toBe(true);
    expect(b.get(asNodeId('n1'))?.pose).toEqual(POSE);
    b.undo();
    expect(b.get(asNodeId('n1'))).toBeUndefined();
    b.redo(); b.redo();
    expect(b.get(asNodeId('n1'))?.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('consumer registerOp kinds round-trip when re-registered before restore', () => {
    let ext = 'initial';
    const handler = {
      apply: (p: { from: string; to: string }) => { ext = p.to; },
      revert: (p: { from: string; to: string }) => { ext = p.from; },
    };
    const a = makeScene();
    a.registerOp('app:rename', handler);
    a.recordOp({ kind: 'app:rename', payload: { from: 'initial', to: 'renamed' } });
    const snap = a.serializeHistory();

    const b = makeScene();
    b.registerOp('app:rename', handler);
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    ext = 'renamed'; // state at snapshot head
    b.undo();
    expect(ext).toBe('initial');
    b.redo();
    expect(ext).toBe('renamed');
  });

  it('unknown op kinds restore as placeholders that keep their stack slot', () => {
    const a = makeScene();
    a.registerOp('app:oneoff', { apply: () => {}, revert: () => {} });
    a.recordOp({ kind: 'app:oneoff', payload: null });
    a.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();       // 'app:oneoff' NOT re-registered
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(b.historyEntries()).toHaveLength(2); // slot preserved
    b.undo();                                    // undoes the add
    b.undo();                                    // placeholder — no throw, no effect
    expect(b.canUndo()).toBe(false);
  });

  it('restoreHistory replaces existing history and restored entries never coalesce', () => {
    // Coalescing enabled + fake timers so a merge is actually possible —
    // the assertion exercises the engine's timestamp-0 anti-coalesce rule
    // for restored entries, not a coalescing-disabled tautology.
    vi.useFakeTimers();
    try {
      const mkTimed = () => createScene<Data, Layer>({
        systemLayers: [
          { id: 'background' },
          { id: 'structures' },
          { id: 'plantings' },
        ],
        coalesceWindowMs: 500,
      });
      const a = mkTimed();
      a.add({ id: asNodeId('n1'), kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'x' } });
      a.setPose(asNodeId('n1'), { x: 2, y: 2, width: 10, height: 10 });
      const snap = a.serializeHistory();
      const b = mkTimed();
      b.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'pre' } });
      b.loadState(a.toJSON());   // clears history + state
      b.restoreHistory(snap);
      expect(b.historyEntries()).toHaveLength(2);
      // Immediately setPose n1 again — matching coalesce key, well inside
      // the 500ms window — must NOT merge into the restored setPose entry.
      b.setPose(asNodeId('n1'), { x: 5, y: 5, width: 10, height: 10 });
      expect(b.historyEntries()).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restoreHistory notifies subscribers exactly once', () => {
    const a = makeScene();
    a.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    let n = 0;
    b.subscribe(() => { n++; });
    b.restoreHistory(snap);
    expect(n).toBe(1);
  });

  it('clip containers re-attach clipFromPose on redo after a round-trip (clipKey)', () => {
    const fn = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const mk = () => createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: { clipFromPose: { ellipse: fn } },
    });
    const a = mk();
    a.add({ id: asNodeId('bed'), kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' }, clipFromPose: fn });
    a.undo(); // head state: container absent; the add entry sits on the redo stack
    const snap = a.serializeHistory();
    const b = mk();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    b.redo(); // re-adds the container in a fresh session — cache is empty
    const node = b.get(asNodeId('bed'));
    expect(node?.kind).toBe('group');
    expect((node as { clipFromPose?: unknown }).clipFromPose).toBe(fn);
  });

  it('clipKey miss against an empty registry restores the container without a clip, no throw', () => {
    const fn = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const a = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: { clipFromPose: { ellipse: fn } },
    });
    a.add({ id: asNodeId('bed'), kind: 'group', layer: 'structures', pose: POSE, data: { label: 'bed' }, clipFromPose: fn });
    a.undo(); // head state: container absent; the add entry carries the clipKey
    const snap = a.serializeHistory();
    const b = createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: {},
    });
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(() => b.redo()).not.toThrow();
    const node = b.get(asNodeId('bed'));
    expect(node?.kind).toBe('group');
    expect((node as { clipFromPose?: unknown }).clipFromPose).toBeUndefined();
  });
});
