import { describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import type { HistoryStep } from './historyTypes';
import type { Op } from './op';

interface Box { v: number }

function setOp(from: number, to: number): Op {
  return {
    name: 'test:set',
    args: { from, to },
    apply(a: Box) { a.v = to; },
    invert: () => setOp(to, from),
  } as Op;
}

function threeUndoneTwo(opts: { branching?: boolean; onEvict?: (e: { id: number }) => void } = {}) {
  const box = { v: 0 };
  const history = createHistory(box, opts);
  history.applyOps([setOp(0, 1)], 'one');
  history.applyOps([setOp(1, 2)], 'two');
  history.applyOps([setOp(2, 3)], 'three');
  history.undo();
  history.undo();
  return { box, history };
}

describe('History.dropRedo', () => {
  it('empties the redo stack and leaves the undo stack and the state alone', () => {
    const { box, history } = threeUndoneTwo();
    const version = history.getVersion();
    history.dropRedo();
    expect(history.canRedo()).toBe(false);
    expect(history.undoDepth()).toBe(1);
    expect(box.v).toBe(1);
    expect(history.getVersion()).toBeGreaterThan(version);
    history.undo();
    expect(box.v).toBe(0);
  });

  it('evicts what it drops, and reports it as one drop step, next redo first', () => {
    const onEvict = vi.fn();
    const { history } = threeUndoneTwo({ onEvict });
    const steps: HistoryStep[] = [];
    history.observe((s) => steps.push(s));
    history.dropRedo();
    expect(onEvict.mock.calls.map(([e]) => e.label)).toEqual(['three', 'two']);
    expect(steps.map((s) => [s.kind, s.entries.map((e) => e.label)])).toEqual([['drop', ['two', 'three']]]);
  });

  it('keeps what it drops as a branch on a branching history', () => {
    const { history } = threeUndoneTwo({ branching: true });
    history.dropRedo();
    expect(history.canRedo()).toBe(false);
    const [branch] = history.branches();
    expect(branch).toMatchObject({ label: 'two', length: 2, current: false });
  });

  it('does nothing with nothing to redo', () => {
    const history = createHistory({ v: 0 });
    history.applyOps([setOp(0, 1)], 'one');
    const listener = vi.fn();
    history.subscribe(listener);
    const version = history.getVersion();
    history.dropRedo();
    expect(history.getVersion()).toBe(version);
    expect(listener).not.toHaveBeenCalled();
  });
});
