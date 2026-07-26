/**
 * Core's `createHistory` wrapper — the seam that hands the global op-factory
 * registry to the registry-agnostic engine in `@weasel-js/history`.
 *
 * These cases live here rather than in the history package because they are
 * core↔history integration: they only pass when something supplies the
 * registry as the restore-time rebuild hook, which is precisely this wrapper's
 * job. The engine's own suite covers restore with an explicitly injected hook.
 */
import { describe, expect, it } from 'vitest';
import type { Op } from '@weasel-js/history';
import { createHistory } from './createHistory';
import { createTransformOp } from './transform';
import { registerOpFactory } from './registry';

interface Pose { x: number; y: number }

function makeAdapter() {
  const state = new Map<string, Pose>();
  return {
    setPose: (id: string, pose: Pose) => state.set(id, { ...pose }),
    state,
  };
}

describe('createHistory (core wrapper) — serialize / restore via the registry', () => {
  it('round-trips an undo stack across save / restore', () => {
    const a1 = makeAdapter();
    const h1 = createHistory(a1);
    h1.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    h1.apply(createTransformOp<Pose>({ id: 'a', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }));
    const snap = h1.serialize();
    expect(snap.undoStack).toHaveLength(2);
    expect(snap.redoStack).toHaveLength(0);

    // Fresh adapter and history; pre-seed the adapter to the post-edit state
    // (this is the post-reload world: the scene has already been restored,
    // and history.restore is just rehydrating the stack on top of it).
    const a2 = makeAdapter();
    a2.state.set('a', { x: 2, y: 2 });
    const h2 = createHistory(a2);
    h2.restore(snap);
    expect(h2.canUndo()).toBe(true);
    expect(h2.canRedo()).toBe(false);
    // First undo lands on the intermediate state ({1,1}); second on origin.
    h2.undo();
    expect(a2.state.get('a')).toEqual({ x: 1, y: 1 });
    h2.undo();
    expect(a2.state.get('a')).toEqual({ x: 0, y: 0 });
    expect(h2.canUndo()).toBe(false);
    expect(h2.canRedo()).toBe(true);
    h2.redo();
    expect(a2.state.get('a')).toEqual({ x: 1, y: 1 });
  });

  it('preserves redo stack across restore', () => {
    const a1 = makeAdapter();
    const h1 = createHistory(a1);
    h1.apply(createTransformOp<Pose>({ id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }));
    h1.apply(createTransformOp<Pose>({ id: 'a', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }));
    h1.undo(); // one entry on redo
    const snap = h1.serialize();
    expect(snap.undoStack).toHaveLength(1);
    expect(snap.redoStack).toHaveLength(1);

    const a2 = makeAdapter();
    a2.state.set('a', { x: 1, y: 1 });
    const h2 = createHistory(a2);
    h2.restore(snap);
    expect(h2.canUndo()).toBe(true);
    expect(h2.canRedo()).toBe(true);
    h2.redo();
    expect(a2.state.get('a')).toEqual({ x: 2, y: 2 });
  });

  it('a per-instance rebuildOp returning null falls back to the global registry', () => {
    interface Cell { x: number }
    const cell: Cell = { x: 0 };
    // Unique name per test run — the global registry has no reset in the barrel.
    const NAME = 'corerebuildtest:global-fallback';
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      const mk = (f: number, t: number): Op => ({
        name: NAME, args: { from: f, to: t },
        apply: () => { cell.x = t; },
        invert: () => mk(t, f),
      });
      return mk(from, to);
    });

    // Hook always returns null, so every rebuild must fall through to the registry.
    const h = createHistory(null, { rebuildOp: () => null });
    h.applyOps([{
      name: NAME, args: { from: 0, to: 3 },
      apply: () => { cell.x = 3; },
      invert: () => ({
        name: NAME, args: { from: 3, to: 0 },
        apply: () => { cell.x = 0; },
        invert: () => { throw new Error('unused'); },
      }),
    }], 'set');
    expect(cell.x).toBe(3);

    const snap = h.serialize();
    const h2 = createHistory(null, { rebuildOp: () => null });
    h2.restore(snap);
    h2.undo();
    expect(cell.x).toBe(0);
    h2.redo();
    expect(cell.x).toBe(3);
  });
});
