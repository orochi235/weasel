import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Box { v: number }

function setOp(from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { from, to },
    coalesceKey: 'v',
    apply(a: Box) { a.v = to; },
    invert: () => setOp(to, from),
  } as Op;
}

function open(start: number) {
  let t = 0;
  const box: Box = { v: start };
  const parent = createHistory(box, { coalesceWindowMs: 500, now: () => t });
  return { box, parent, tick: (ms: number) => { t += ms; } };
}

describe('Journal.commit after coalescing', () => {
  it('undoes to the value the session opened on, and redoes to the one it closed on', () => {
    const { box, parent, tick } = open(0);
    const j = parent.beginJournal({ label: 'session' });
    j.applyBatch([setOp(0, 1)], 'set');
    tick(10);
    j.applyBatch([setOp(1, 2)], 'set');
    expect(j.entries().undo).toHaveLength(1);
    j.commit('Edit');

    parent.undo();
    expect(box.v).toBe(0);
    parent.redo();
    expect(box.v).toBe(2);
    parent.undo();
    expect(box.v).toBe(0);
  });

  it('round-trips a session mixing coalesced and separate entries', () => {
    const { box, parent, tick } = open(5);
    const j = parent.beginJournal({ label: 'session' });
    j.applyBatch([setOp(5, 6)], 'set');
    tick(10);
    j.applyBatch([setOp(6, 7)], 'set');
    tick(1000);
    j.applyBatch([setOp(7, 8)], 'set');
    tick(10);
    j.applyBatch([setOp(8, 9)], 'set');
    expect(j.entries().undo).toHaveLength(2);
    j.commit('Edit');

    expect(parent.undoDepth()).toBe(1);
    parent.undo();
    expect(box.v).toBe(5);
    parent.redo();
    expect(box.v).toBe(9);
  });

  it('keeps both halves through serialize and restore', () => {
    const { box, parent, tick } = open(0);
    const j = parent.beginJournal({ label: 'session' });
    j.applyBatch([setOp(0, 1)], 'set');
    tick(10);
    j.applyBatch([setOp(1, 2)], 'set');
    j.commit('Edit');

    const restored = createHistory(box, {
      rebuildOp: (_name, args) => {
        const a = args as { from: number; to: number };
        return setOp(a.from, a.to);
      },
    });
    restored.restore(JSON.parse(JSON.stringify(parent.serialize())));
    restored.undo();
    expect(box.v).toBe(0);
    restored.redo();
    expect(box.v).toBe(2);
  });
});
