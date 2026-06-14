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

describe('forkedAtEntryId', () => {
  it('captures the parent\'s current entry-id frontier at journal creation', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);

    parent.applyOps([pushOp(1)], 'a');
    parent.applyOps([pushOp(2)], 'b');
    const frontier = parent.currentEntryId();

    const j = parent.beginJournal({ label: 's' });
    expect(j.forkedAtEntryId).toBe(frontier);
  });

  it('subsequent parent ops do not change a journal\'s forkedAtEntryId', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);

    const j = parent.beginJournal({ label: 's' });
    const captured = j.forkedAtEntryId;

    parent.applyOps([pushOp(99)], 'after-fork');

    expect(j.forkedAtEntryId).toBe(captured);
    expect(parent.currentEntryId()).toBeGreaterThan(captured);
  });
});
