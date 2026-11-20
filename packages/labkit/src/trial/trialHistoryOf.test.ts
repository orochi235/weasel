import { createHistory, type Op } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { lastEditStamp } from '../undo/editStamp';
import { trialHistoryOf } from './trialHistoryOf';

function setCell(cell: { x: number }, from: number, to: number): Op {
  return {
    name: 'test:trialEntry',
    args: { from, to },
    apply: () => {
      cell.x = to;
    },
    invert: () => setCell(cell, to, from),
  };
}

describe('trialHistoryOf', () => {
  it("saves the entries the trial recorded on it, and restores them through the trial's rebuild", () => {
    const before = { x: 0 };
    const first = trialHistoryOf(createHistory(null));
    const op = setCell(before, 0, 4);
    op.apply(null);
    first.record(op, 'config.change');
    const saved = JSON.parse(JSON.stringify(first.serialize?.()));

    const after = { x: 4 };
    const second = trialHistoryOf(createHistory(null));
    second.restore?.(saved, (name, args) => {
      const { from, to } = args as { from: number; to: number };
      return name === 'test:trialEntry' ? setCell(after, from, to) : null;
    });
    expect(second.canUndo()).toBe(true);
    second.undo();
    expect(after.x).toBe(0);
  });

  it('stamps each step with editStamp while subscribed, so two in one millisecond still order', () => {
    const source = trialHistoryOf(createHistory(null));
    const off = source.subscribe(() => {});
    const cell = { x: 0 };
    source.record(setCell(cell, 0, 1), 'one');
    const one = source.undoStamp?.();
    source.record(setCell(cell, 1, 2), 'two');
    const two = source.undoStamp?.();
    off();
    expect(two).toBe(lastEditStamp());
    expect(two).toBeGreaterThan(one ?? Number.POSITIVE_INFINITY);
  });
});
