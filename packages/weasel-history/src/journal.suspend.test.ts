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

describe('Journal.suspend', () => {
  it('leaves the scene and parent history untouched', () => {
    const adapter = { values: [10] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.applyBatch([pushOp(2)], 'b');
    expect(adapter.values).toEqual([10, 1, 2]);

    j.suspend();

    // Scene mutations remain in place (not rolled back like cancel)
    expect(adapter.values).toEqual([10, 1, 2]);
    // Nothing committed to parent yet
    expect(parent.entries().undo.length).toBe(0);
  });

  it('closes the journal; further ops throw', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'session' });

    j.applyBatch([pushOp(1)], 'a');
    j.suspend();

    expect(j.isActive()).toBe(false);
    expect(() => j.applyBatch([pushOp(2)], 'after')).toThrow();
  });
});
