/**
 * Property tests of `planKey` and `keyStep` on random menus and stacks reached by random keys: the plan's stack is
 * the very array it was given whenever nothing moved, and a new one exactly when something did; a key `keyStep`
 * does not take goes on to the access letter and typeahead only when it is one character; and every stack a plan
 * gives is well formed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EMPTY_TYPEAHEAD, type TypeaheadBuffer } from '@weasel-js/ui-logic';
import { entriesAt, isRow } from './entries';
import { keyStep, type MenuStack } from './keys';
import { planKey } from './keyPlan';
import type { MenuDirection } from './placement';
import { entries, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const KEYS = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ', '+', '-', 'a', 'A', 'b', 'c', 'ä', '2', 'x', 'Shift', '😀'];
const same = (a: MenuStack, b: MenuStack) => a.length === b.length && a.every((x, i) => x === b[i]);

describe('planKey', () => {
  it('hands back the same stack when nothing moved, and a well-formed new one when something did', () => {
    const t = tally();
    fc.assert(fc.property(entries.filter((xs) => xs.length > 0), fc.array(fc.tuple(fc.constantFrom(...KEYS), fc.constantFrom<MenuDirection>('ltr', 'rtl')), { minLength: 1, maxLength: 25 }),
      (root, keys) => {
        let stack: MenuStack = [null];
        let typed: TypeaheadBuffer = EMPTY_TYPEAHEAD;
        let now = 0;
        for (const [key, dir] of keys) {
          now += 100;
          const plan = planKey(root, stack, typed, key, now, dir);
          const step = keyStep(root, stack, key, dir);
          if (!step.handled) expect(plan === null).toBe([...key].length !== 1 || key === ' ');
          if (plan === null) { t.count('not ours'); continue; }
          if (same(plan.stack, stack)) { expect(plan.stack).toBe(stack); t.count('stayed'); } else t.count('moved');
          for (let i = 0; i < plan.stack.length; i++) {
            const at = plan.stack[i];
            const rows = entriesAt(root, plan.stack, i);
            if (i < plan.stack.length - 1) expect(rows[at!]?.kind).toBe('submenu');
            else if (at !== null) expect(isRow(rows[at!]!)).toBe(true);
          }
          stack = plan.stack;
          typed = plan.typed;
        }
      }), runs(RUNS));
    t.atLeast('stayed', RUNS);
    t.atLeast('moved', RUNS / 3);
    t.atLeast('not ours', RUNS / 10);
  }, timeoutFor(RUNS, 3));
});

describe('planKey, shrunk', () => {
  it('keeps the stack when typeahead lands on the row already highlighted', () => {
    const root = [{ kind: 'item' as const, key: 'i', label: 'Apple', run: () => {} }];
    const stack: MenuStack = [0];
    expect(planKey(root, stack, EMPTY_TYPEAHEAD, 'a', 0)!.stack).toBe(stack);
  });

  it('keeps the stack when an access letter names the value row already highlighted', () => {
    const root = [{ kind: 'text' as const, key: 't', label: 'Name', access: 'n', value: '', set: () => {} }];
    const stack: MenuStack = [0];
    expect(planKey(root, stack, EMPTY_TYPEAHEAD, 'n', 0)!.stack).toBe(stack);
  });
});
