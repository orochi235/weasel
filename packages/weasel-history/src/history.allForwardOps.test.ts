import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';

function pushOp(value: number): Op {
  return {
    name: 'test:push',
    args: { value },
    apply(a: { values: number[] }) { a.values.push(value); },
    invert(): Op {
      return {
        name: 'test:pop',
        args: { value },
        apply(a: { values: number[] }) { a.values.pop(); },
        invert: () => pushOp(value),
      } as Op;
    },
  } as Op;
}

describe('History.allForwardOps', () => {
  it('returns empty when the undo stack is empty', () => {
    const h = createHistory({ values: [] });
    expect(h.allForwardOps()).toEqual([]);
  });

  it('returns all forward ops across all undo entries, in order', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'a');
    h.applyOps([pushOp(2), pushOp(3)], 'b');
    h.applyOps([pushOp(4)], 'c');

    const ops = h.allForwardOps();
    expect(ops.length).toBe(4);
    expect(ops.map((o) => (o.args as { value: number }).value)).toEqual([1, 2, 3, 4]);
  });

  it('excludes ops from undone (redo-stack) entries', () => {
    const adapter = { values: [] as number[] };
    const h = createHistory(adapter);
    h.applyOps([pushOp(1)], 'a');
    h.applyOps([pushOp(2)], 'b');
    h.undo();

    const ops = h.allForwardOps();
    expect(ops.length).toBe(1);
    expect((ops[0].args as { value: number }).value).toBe(1);
  });
});
