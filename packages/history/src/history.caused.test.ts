import { describe, expect, it } from 'vitest';
import { createHistory, touchedIdsFromOps } from './history';
import type { Op } from './op';

/** A cell, a write to it, and an op that decides what to write as it runs
 *  and names that write as what it caused. */
function fixture() {
  const cell = { v: 0 };
  const log: string[] = [];
  const write = (from: number, to: number, key?: string): Op => ({
    name: 'write',
    args: { id: `to-${to}`, from, to },
    ...(key !== undefined ? { coalesceKey: key } : {}),
    apply: () => { cell.v = to; log.push(`write ${to}`); },
    invert: () => write(to, from, key),
  });
  const decide = (next: () => number, key?: string): Op => {
    let caused: Op[] = [];
    const op: Op = {
      name: 'decide',
      apply: () => {
        const from = cell.v;
        const to = next();
        log.push('decide');
        cell.v = to;
        caused = [write(from, to, key)];
      },
      caused: () => caused,
      invert: () => ({ apply: () => { log.push('undecide'); }, invert: () => op }),
    };
    return op;
  };
  return { cell, log, write, decide };
}

describe('an op that names what it caused', () => {
  it('is replaced in the entry by those ops, which undo and redo replay', () => {
    const { cell, log, decide } = fixture();
    const history = createHistory(null);
    history.applyOps([decide(() => 5)], 'edit');
    expect(history.allForwardOps().map((op) => op.name)).toEqual(['write']);
    log.length = 0;

    history.undo();
    expect(cell.v).toBe(0);
    history.redo();
    expect(cell.v).toBe(5);
    expect(log).toEqual(['write 0', 'write 5']);
  });

  it('takes the entry\'s touched ids from what it caused', () => {
    const { decide } = fixture();
    const history = createHistory(null);
    history.applyOps([decide(() => 5)], 'edit');
    expect([...history.entries().undo[0]!.touchedIds!]).toEqual(['to-5']);
  });

  it('coalesces on the keys of what it caused', () => {
    const { cell, decide } = fixture();
    const history = createHistory(null, { coalesceWindowMs: 1000, now: () => 0 });
    history.applyOps([decide(() => 1, 'k')], 'edit');
    history.applyOps([decide(() => 2, 'k')], 'edit');
    history.applyOps([decide(() => 3, 'other')], 'edit');
    expect(history.undoDepth()).toBe(2);
    history.undo();
    history.undo();
    expect(cell.v).toBe(0);
  });

  it('pushes no entry when it caused nothing', () => {
    const history = createHistory(null);
    const op: Op = { apply: () => {}, caused: () => [], invert: () => op };
    history.applyOps([op], 'edit');
    expect(history.undoDepth()).toBe(0);
  });

  it('is inverted as itself when a later op in its batch throws', () => {
    const { log, decide } = fixture();
    const history = createHistory(null);
    const boom: Op = { apply: () => { throw new Error('boom'); }, invert: () => boom };
    expect(() => history.applyOps([decide(() => 5), boom], 'edit')).toThrow('boom');
    expect(log).toEqual(['decide', 'undecide']);
    expect(history.undoDepth()).toBe(0);
  });

  it('is replaced in a journal\'s entry too, and in what the journal commits', () => {
    const { cell, decide } = fixture();
    const history = createHistory(null);
    const journal = history.beginJournal({ label: 'mode' });
    journal.applyBatch([decide(() => 5)], 'edit');
    journal.undo();
    expect(cell.v).toBe(0);
    journal.redo();
    journal.commit('mode');
    expect(history.allForwardOps().map((op) => op.name)).toEqual(['write']);
  });
});

describe('touchedIdsFromOps', () => {
  it('reads every id in args.nodes', () => {
    const op: Op = { args: { nodes: [{ id: 'a' }, { id: 'b' }, null, { other: 1 }] }, apply: () => {}, invert: () => op };
    expect([...touchedIdsFromOps([op])]).toEqual(['a', 'b']);
  });
});
