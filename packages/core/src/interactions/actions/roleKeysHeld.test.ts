/** A drag bound to an action that reads modifier roles starts with any role's key already held. */
import { describe, expect, it } from 'vitest';
import { matchModifiers } from '@weasel-js/gestures';
import { actionBindings, type Action, type ModifierRoles } from '@weasel-js/routing';
import { editAnchorsAction } from './edit-anchors/action';
import { marqueeAnchorsAction } from './defaults/anchorEditing';

const KEY_FLAG = { shift: 'shiftKey', alt: 'altKey', ctrl: 'ctrlKey', meta: 'metaKey' } as const;

function keysOf(roles: ModifierRoles): string[] {
  return [...new Set(Object.values(roles).flatMap((r) => r.keys.flatMap((k) => (k === 'mod' ? ['meta', 'ctrl'] : [k]))))];
}

describe.each([editAnchorsAction, marqueeAnchorsAction] as Action[])('$id', (action) => {
  it.each(keysOf(action.modifierRoles!))('matches its drag with %s held', (key) => {
    const e = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, [KEY_FLAG[key as keyof typeof KEY_FLAG]]: true };
    for (const { spec } of actionBindings(action)) {
      expect(matchModifiers(e, spec.mods, true)).toBe(true);
      expect(matchModifiers(e, spec.mods, false)).toBe(true);
    }
  });
});
