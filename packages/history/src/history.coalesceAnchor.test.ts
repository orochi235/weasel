import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

/** Absolute set-to-value op — the shape coalescing is defined for. */
function setOp(target: { v: number }, from: number, to: number, key: string): Op {
  const op: Op = {
    name: 'set',
    args: { to },
    coalesceKey: key,
    apply() { target.v = to; },
    invert: () => setOp(target, to, from, key),
  };
  return op;
}

describe('coalesce anchoring', () => {
  it('does not merge into an entry the user has stepped back onto', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });

    h.applyOps([setOp(t, 0, 1, 'k')], 'e1');
    clock = 1100;
    h.applyOps([setOp(t, 1, 2, 'other')], 'e2');
    h.undo();                                    // e2 → redo, v back to 1
    clock = 1200;                                // still inside e1's window
    h.applyOps([setOp(t, 1, 9, 'k')], 'e3');

    expect(h.entries().undo.map((e) => e.label)).toEqual(['e1', 'e3']);
    h.undo();
    expect(t.v).toBe(1);                         // back to e1's result, not past it
    h.undo();
    expect(t.v).toBe(0);
  });

  it('does not merge into a restored entry', () => {
    const t = { v: 0 };
    let clock = 100;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.applyOps([setOp(t, 0, 1, 'k')], 'e1');
    const snap = h.serialize();

    const t2 = { v: 1 };
    const h2 = createHistory(t2, {
      coalesceWindowMs: 500,
      now: () => clock,
      rebuildOp: () => setOp(t2, 0, 1, 'k'),
    });
    h2.restore(snap);
    clock = 200;
    h2.applyOps([setOp(t2, 1, 7, 'k')], 'e2');
    expect(h2.entries().undo.map((e) => e.label)).toEqual(['e1', 'e2']);
  });

  it('does not merge into an entry a redo stepped back onto', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.applyOps([setOp(t, 0, 1, 'k')], 'e1');
    h.undo();
    h.redo();
    clock = 1100;
    h.applyOps([setOp(t, 1, 5, 'k')], 'e2');
    expect(h.entries().undo.map((e) => e.label)).toEqual(['e1', 'e2']);
  });

  it('does not merge into an entry recordEntry pushed', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.recordEntry([setOp(t, 0, 1, 'k')], 'e1');
    clock = 1100;
    h.applyOps([setOp(t, 1, 5, 'k')], 'e2');
    expect(h.entries().undo.map((e) => e.label)).toEqual(['e1', 'e2']);
  });

  it('does not merge into an entry goto stepped back onto', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.applyOps([setOp(t, 0, 1, 'k')], 'e1');
    h.goto(0);
    h.goto(1);
    clock = 1100;
    h.applyOps([setOp(t, 1, 5, 'k')], 'e2');
    expect(h.entries().undo.map((e) => e.label)).toEqual(['e1', 'e2']);
  });

  it('does not merge into a restored entry that reuses the live entry id', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock, rebuildOp: () => setOp(t, 0, 1, 'k') });
    h.applyOps([setOp(t, 0, 1, 'k')], 'live');
    const snap = h.serialize();
    // Same instance, and the snapshot's only entry carries the id the live
    // push just anchored on.
    expect(snap.undoStack[0].id).toBe(1);
    h.restore(snap);
    clock = 1100;
    h.applyOps([setOp(t, 1, 5, 'k')], 'after');
    expect(h.entries().undo.map((e) => e.label)).toEqual(['live', 'after']);
  });

  it('still merges a sustained burst of matching edits', () => {
    const t = { v: 0 };
    let clock = 1000;
    const h = createHistory(t, { coalesceWindowMs: 500, now: () => clock });
    h.applyOps([setOp(t, 0, 1, 'k')], 'nudge');
    for (let i = 2; i <= 6; i++) {
      clock += 100;
      h.applyOps([setOp(t, i - 1, i, 'k')], 'nudge');
    }
    expect(h.undoDepth()).toBe(1);
    expect(t.v).toBe(6);
    h.undo();
    expect(t.v).toBe(0);
  });
});
