/** A drag bound to an action that reads modifier roles starts with any role's key already held. */
import { describe, expect, it } from 'vitest';
import { matchModifiers } from '@weasel-js/gestures';
import type { Action, ModifierRoles } from '@weasel-js/routing';
import { editAnchorsAction } from './edit-anchors/action';
import { marqueeAnchorsAction } from './defaults/anchorEditing';

const KEY_FLAG = { shift: 'shiftKey', alt: 'altKey', ctrl: 'ctrlKey', meta: 'metaKey' } as const;

function keysOf(roles: ModifierRoles): string[] {
  return [...new Set(Object.values(roles).flatMap((r) => r.keys.flatMap((k) => (k === 'mod' ? ['meta', 'ctrl'] : [k]))))];
}

describe.each([editAnchorsAction, marqueeAnchorsAction] as Action[])('$id', (action) => {
  it.each(keysOf(action.modifierRoles!))('matches its drag with %s held', (key) => {
    const e = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, [KEY_FLAG[key as keyof typeof KEY_FLAG]]: true };
    for (const binding of action.defaultBinding!) {
      expect(matchModifiers(e, binding.spec.mods, true)).toBe(true);
      expect(matchModifiers(e, binding.spec.mods, false)).toBe(true);
    }
  });
});
