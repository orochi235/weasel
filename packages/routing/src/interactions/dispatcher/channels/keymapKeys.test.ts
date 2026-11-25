import { expect, it } from 'vitest';
import type { KeymapStack } from '../../../keymaps/keymapStack';
import { keymapKeys } from './keymapKeys';

it('stops dropping the repeats of a keystroke that closed a keymap with Cmd down once Cmd comes up', () => {
  let open: object | null = {};
  const stack = { innermost: () => open, holdOpened: () => false, release: () => {} } as unknown as KeymapStack;
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: '=', code: 'Equal', metaKey: true }), 'Equal', () => { open = null; });
  expect(keys.quiet('Equal')).toBe(true);
  keys.up(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }), 'MetaLeft');
  expect(keys.quiet('Equal')).toBe(false);
});

it('keeps dropping them across Cmd coming up when Cmd was not down with the keystroke', () => {
  let open: object | null = {};
  const stack = { innermost: () => open, holdOpened: () => false, release: () => {} } as unknown as KeymapStack;
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' }), 'KeyX', () => { open = null; });
  keys.up(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }), 'MetaLeft');
  expect(keys.quiet('KeyX')).toBe(true);
});
