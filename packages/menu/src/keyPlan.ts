import { accessMatch } from './access';
import { entriesAt } from './entries';
import type { MenuEntry } from './entries';
import { firstRow, keyStep, type KeyEffect, type MenuStack } from './keys';
import type { MenuDirection } from './placement';
import { EMPTY_TYPEAHEAD, isOneChar, type TypeaheadBuffer } from '@weasel-js/ui-input';
import { typeaheadStep } from './typeahead';

export interface KeyPlan {
  stack: MenuStack;
  typed: TypeaheadBuffer;
  effect: KeyEffect;
}

/** What one key does to an open menu: navigation, then an access letter, then typeahead.
 *  `null` when the key is none of the menu's. `stack` is the same array when nothing moved. */
export function planKey(
  root: readonly MenuEntry[],
  stack: MenuStack,
  typed: TypeaheadBuffer,
  key: string,
  now: number,
  dir: MenuDirection = 'ltr',
): KeyPlan | null {
  const r = keyStep(root, stack, key, dir);
  if (r.handled) {
    return { stack: r.stack, typed: r.stack !== stack ? EMPTY_TYPEAHEAD : typed, effect: r.effect };
  }
  if (!isOneChar(key) || key === ' ') return null;
  const level = stack.length - 1;
  const rows = entriesAt(root, stack, level);
  const letter = accessMatch(rows, key);
  if (letter !== null) {
    const e = rows[letter];
    if (e?.kind === 'item' && !e.disabled) {
      return { stack, typed: EMPTY_TYPEAHEAD, effect: { kind: 'choose', level, index: letter } };
    }
    // A value row has nothing to run: its letter highlights it, where Enter edits it.
    const opened = e === undefined || e.kind === 'separator' || e.disabled ? stack
      : e.kind === 'submenu' ? [...stack.slice(0, level), letter, firstRow(e.entries)]
        : highlight(stack, letter);
    return { stack: opened, typed: EMPTY_TYPEAHEAD, effect: { kind: 'none' } };
  }
  const t = typeaheadStep(rows, stack[level] ?? null, typed, key, now);
  const next = t.hit === null ? stack : highlight(stack, t.hit);
  return { stack: next, typed: t.buffer, effect: { kind: 'none' } };
}

/** `stack` with its top level's highlight on `index`: `stack` itself when it is there already. */
function highlight(stack: MenuStack, index: number): MenuStack {
  return stack.at(-1) === index ? stack : [...stack.slice(0, -1), index];
}
