/**
 * Bundling two feature's entries into one registry. Order is the whole
 * contract: `scopeBindings` emits in entry order and `matchSorted` breaks
 * same-specificity ties by declaration order, so a merge that reorders
 * silently changes which binding wins.
 */
import { describe, expect, it } from 'vitest';
import { mergeContributions } from './merge';
import { scopeBindings } from './assemble';
import type { Contribution } from './types';

const entry = (id: string, actionId: string): Contribution => ({
  id,
  eligibility: { always: true },
  bindings: [{ spec: { kind: 'click' }, actionId }],
});

describe('mergeContributions', () => {
  it('keeps bundle order, so the first bundle still wins a tie', () => {
    const merged = mergeContributions([entry('a', 'a.click')], [entry('b', 'b.click')]);
    const scoped = scopeBindings(merged, { focusedId: null, heldTriggers: new Set() });
    expect(scoped.map((s) => s.binding.actionId)).toEqual(['a.click', 'b.click']);
  });

  it('throws naming the duplicate id', () => {
    // Dropping one silently is how a feature loses its bindings with no
    // diagnostic — the failure class this registry exists to reduce.
    expect(() => mergeContributions([entry('dup', 'x')], [entry('dup', 'y')]))
      .toThrow(/dup/);
  });

  it('merges no bundles into no entries', () => {
    expect(mergeContributions()).toEqual([]);
  });
});
