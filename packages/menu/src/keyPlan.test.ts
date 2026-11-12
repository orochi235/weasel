import { describe, expect, it } from 'vitest';
import { EMPTY_TYPEAHEAD, type TypeaheadBuffer } from '@weasel-js/ui-input';
import { planKey } from './keyPlan';
import type { MenuStack } from './keys';
import type { MenuEntry } from './entries';

const run = () => {};
const root: MenuEntry[] = [
  { kind: 'item', key: 'a', label: 'Save', run },
  { kind: 'item', key: 'b', label: 'Save As…', run },
];

/** `keys` typed into an open menu `step` ms apart, from a highlight on the first row. */
function type(keys: string[], step = 50) {
  let stack: MenuStack = [0];
  let typed: TypeaheadBuffer = EMPTY_TYPEAHEAD;
  const effects: string[] = [];
  for (const [i, key] of keys.entries()) {
    const plan = planKey(root, stack, typed, key, 1000 + i * step);
    if (!plan) continue;
    stack = plan.stack;
    typed = plan.typed;
    effects.push(plan.effect.kind);
  }
  return { stack, effects };
}

describe('planKey', () => {
  it('types a space mid-search, as a list does, so a label with one is found', () => {
    const r = type([...'save a']);
    expect(r.effects).not.toContain('choose');
    expect(r.stack).toEqual([1]);
  });

  it('chooses on a space once the search has lapsed', () => {
    expect(type(['s', ' '], 600).effects).toContain('choose');
    expect(type([' ']).effects).toEqual(['choose']);
  });
});
