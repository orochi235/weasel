import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

function makeArrayAdapter(): { values: number[] } {
  return { values: [] };
}

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) {
      a.values.push(value);
    },
    invert() {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) {
          a.values.pop();
        },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('History.recordEntry', () => {
  it('pushes an undo entry without applying the ops', () => {
    const adapter = makeArrayAdapter();
    const h = createHistory(adapter);
    const op = pushOp(1);
    op.apply(adapter);
    expect(adapter.values).toEqual([1]);
    h.recordEntry([op], 'manual');
    expect(adapter.values).toEqual([1]);
    expect(h.canUndo()).toBe(true);
  });

  it('undo rolls a recorded entry back and redo re-applies it', () => {
    const adapter = makeArrayAdapter();
    const h = createHistory(adapter);
    const op = pushOp(7);
    op.apply(adapter);
    h.recordEntry([op], 'manual');
    h.undo();
    expect(adapter.values).toEqual([]);
    expect(h.canRedo()).toBe(true);
    h.redo();
    expect(adapter.values).toEqual([7]);
  });
});
