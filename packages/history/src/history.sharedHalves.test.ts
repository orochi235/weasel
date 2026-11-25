import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

type Cells = Record<string, number>;

/** Keys whose writes throw while listed. */
const broken = new Set<string>();

function setOp(key: string, from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { key, from, to },
    coalesceKey: key,
    apply(a: Cells) {
      if (broken.has(key)) throw new Error(`cannot write ${key}`);
      a[key] = to;
    },
    invert: () => setOp(key, to, from),
  } as Op;
}

/** A relative op: applying it twice adds twice. Its inverse throws while `n-` is listed. */
function addOp(key: string, by: number): Op {
  return {
    name: 'test:add',
    args: { key, by },
    apply(a: Cells) {
      if (broken.has(by < 0 ? `${key}-` : key)) throw new Error(`cannot write ${key}`);
      a[key] = (a[key] ?? 0) + by;
    },
    invert: () => addOp(key, -by),
  } as Op;
}

function rebuildOp(name: string, args: unknown): Op | null {
  const a = args as { key: string; from: number; to: number; by: number };
  if (name === 'test:set') return setOp(a.key, a.from, a.to);
  if (name === 'test:add') return addOp(a.key, a.by);
  return null;
}

/** A committed journal holding an add and then a coalesced run of sets, as one parent entry. */
function open() {
  broken.clear();
  let t = 0;
  const cells: Cells = { n: 0, a: 0 };
  const history = createHistory(cells, { coalesceWindowMs: 500, now: () => t, rebuildOp });
  const j = history.beginJournal({ label: 'session' });
  j.applyOps([addOp('n', 1)], 'add');
  t += 1000;
  j.applyOps([setOp('a', 0, 1)], 'set');
  t += 10;
  j.applyOps([setOp('a', 1, 2)], 'set');
  j.commit('Edit');
  return { cells, history };
}

describe('History — a failed step on an entry whose halves share ops', () => {
  it('undo replays a shared op once while unwinding', () => {
    const { cells, history } = open();
    broken.add('n-');
    expect(() => history.undo()).toThrow('cannot write n');
    expect(cells).toEqual({ n: 1, a: 2 });
  });

  it('redo inverts a shared op once while unwinding', () => {
    const { cells, history } = open();
    history.undo();
    broken.add('a');
    expect(() => history.redo()).toThrow('cannot write a');
    expect(cells).toEqual({ n: 0, a: 0 });
  });

  it('keeps the ops shared after a restore', () => {
    const { history: saved } = open();
    const cells: Cells = { n: 1, a: 2 };
    const history = createHistory(cells, { rebuildOp });
    history.restore(saved.serialize());
    broken.add('n-');
    expect(() => history.undo()).toThrow('cannot write n');
    expect(cells).toEqual({ n: 1, a: 2 });
  });
});

/** A write of `to` to `key` that throws while `key=to` is listed. */
function writeOp(key: string, from: number, to: number, coalesceKey?: string): Op {
  return {
    name: 'test:write',
    args: { key, from, to },
    ...(coalesceKey ? { coalesceKey } : {}),
    apply(a: Cells) {
      if (broken.has(`${key}=${to}`)) throw new Error(`cannot write ${key}=${to}`);
      a[key] = to;
    },
    invert: () => writeOp(key, to, from, coalesceKey),
  } as Op;
}

describe('History — a failed step on a coalesced entry followed by a shared op writing the same field', () => {
  /** A coalesced run writing x to 5 and then 10, then an unkeyed write of x to 15, committed as one entry. */
  function session() {
    broken.clear();
    let t = 0;
    const cells: Cells = { x: 0 };
    const history = createHistory(cells, { coalesceWindowMs: 500, now: () => t });
    const j = history.beginJournal({ label: 'session' });
    j.applyOps([writeOp('x', 0, 5, 'x')], 'drag');
    t += 10;
    j.applyOps([writeOp('x', 5, 10, 'x')], 'drag');
    t += 1000;
    j.applyOps([writeOp('x', 10, 15)], 'set');
    j.commit('Edit');
    return { cells, history };
  }

  it('undo leaves the state where it began', () => {
    const { cells, history } = session();
    broken.add('x=0');
    expect(() => history.undo()).toThrow('cannot write x=0');
    expect(cells).toEqual({ x: 15 });
    expect(history.canUndo()).toBe(true);
  });

  it('redo leaves the state where it began', () => {
    const { cells, history } = session();
    history.undo();
    broken.add('x=15');
    expect(() => history.redo()).toThrow('cannot write x=15');
    expect(cells).toEqual({ x: 0 });
  });
});
