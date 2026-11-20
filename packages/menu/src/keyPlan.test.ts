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
function type(keys: string[], step = 50, rows: readonly MenuEntry[] = root) {
  let stack: MenuStack = [0];
  let typed: TypeaheadBuffer = EMPTY_TYPEAHEAD;
  const effects: string[] = [];
  for (const [i, key] of keys.entries()) {
    const plan = planKey(rows, stack, typed, key, 1000 + i * step);
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

  it('types a letter mid-search rather than taking it as an access letter', () => {
    const rows: MenuEntry[] = [
      { kind: 'item', key: 'n', label: 'New', run },
      { kind: 'item', key: 'b', label: 'Bold', run },
      { kind: 'item', key: 'o', label: 'Open', access: 'o', run },
    ];
    const r = type(['b', 'o'], 50, rows);
    expect(r.effects).toEqual(['none', 'none']);
    expect(r.stack).toEqual([1]);
    expect(type(['o'], 50, rows).effects).toEqual(['choose']);
  });

  it('types a minus mid-search rather than stepping the number row it is on', () => {
    const rows: MenuEntry[] = [
      { kind: 'item', key: 'a', label: 'About', run },
      { kind: 'number', key: 'z', label: 'Zoom', value: 1, set: () => {} },
      { kind: 'item', key: 'o', label: 'Zoom-out…', run },
    ];
    const r = type([...'zoom-'], 50, rows);
    expect(r.effects).not.toContain('step');
    expect(r.stack).toEqual([2]);
  });
});
