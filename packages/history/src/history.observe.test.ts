import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { HistoryStep } from './historyTypes';
import type { Op } from './op';

interface Box { v: number }

function setOp(from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { id: 'box', from, to },
    coalesceKey: 'v',
    apply(a: Box) { a.v = to; },
    invert: () => setOp(to, from),
  } as Op;
}

function open(opts: { coalesceWindowMs?: number; branching?: boolean } = {}) {
  const box = { v: 0 };
  const history = createHistory(box, opts);
  const steps: HistoryStep[] = [];
  const off = history.observe((s) => steps.push(s));
  const summary = () => steps.map((s) => [s.kind, s.entries.map((e) => `${e.id}:${e.label}:${e.ops.length}`)]);
  return { box, history, steps, off, summary };
}

describe('History.observe', () => {
  it('reports each push with the entry it made and the ops it holds', () => {
    const t = open();
    const op = setOp(0, 1);
    t.history.applyOps([op], 'Nudge');
    t.history.recordEntry([setOp(1, 2)], 'Commit');
    expect(t.summary()).toEqual([['push', ['1:Nudge:1']], ['push', ['2:Commit:1']]]);
    expect(t.steps[0]!.entries[0]!.ops[0]).toBe(op);
  });

  it('reports a coalesce as a merge into the entry already on top', () => {
    let now = 0;
    const box = { v: 0 };
    const history = createHistory(box, { coalesceWindowMs: 100, now: () => now });
    const steps: HistoryStep[] = [];
    history.observe((s) => steps.push(s));
    history.applyOps([setOp(0, 1)], 'Nudge');
    now = 10;
    history.applyOps([setOp(1, 2)], 'Nudge');
    expect(steps.map((s) => [s.kind, s.entries[0]!.id])).toEqual([['push', 1], ['coalesce', 1]]);
  });

  it('reports undo, redo and goto with the entries each walked across, in the order walked', () => {
    const t = open();
    t.history.applyOps([setOp(0, 1)], 'a');
    t.history.applyOps([setOp(1, 2)], 'b');
    t.history.applyOps([setOp(2, 3)], 'c');
    t.steps.length = 0;
    t.history.undo();
    t.history.redo();
    t.history.goto(0);
    t.history.goto(0);
    expect(t.summary()).toEqual([
      ['undo', ['3:c:1']],
      ['redo', ['3:c:1']],
      ['goto', ['3:c:1', '2:b:1', '1:a:1']],
    ]);
  });

  it('reports clear, restore, prune and a branch switch, and nothing for a step that moved nothing', () => {
    const t = open({ branching: true });
    t.history.undo();
    t.history.clear();
    expect(t.steps).toEqual([]);
    t.history.applyOps([setOp(0, 1)], 'a');
    const snap = t.history.serialize();
    t.history.undo();
    t.history.applyOps([setOp(0, 2)], 'b');
    t.history.undo();
    t.history.switchBranch(1);
    t.history.redo();
    t.history.prune(Number.POSITIVE_INFINITY);
    t.history.restore(snap);
    t.history.clear();
    expect(t.steps.map((s) => s.kind)).toEqual(['push', 'undo', 'push', 'undo', 'branch', 'redo', 'prune', 'restore', 'clear']);
  });

  it('stops reporting once released', () => {
    const t = open();
    t.off();
    t.history.applyOps([setOp(0, 1)], 'a');
    expect(t.steps).toEqual([]);
  });
});
