import { expect, it } from 'vitest';
import { createKeymapStack, type KeymapStack } from '../../../keymaps/keymapStack';
import { keymapKeys } from './keymapKeys';

it('stops dropping the repeats of a keystroke that closed a keymap with Cmd down once Cmd comes up', () => {
  let open: object | null = {};
  const stack = { open: () => (open ? [{ id: 'm' }] : []), holdOpened: () => false, release: () => {} } as unknown as KeymapStack;
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: '=', code: 'Equal', metaKey: true }), 'Equal', () => { open = null; });
  expect(keys.quiet('Equal')).toBe(true);
  keys.up(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }), 'MetaLeft');
  expect(keys.quiet('Equal')).toBe(false);
});

it('keeps dropping them across Cmd coming up when Cmd was not down with the keystroke', () => {
  let open: object | null = {};
  const stack = { open: () => (open ? [{ id: 'm' }] : []), holdOpened: () => false, release: () => {} } as unknown as KeymapStack;
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX' }), 'KeyX', () => { open = null; });
  keys.up(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }), 'MetaLeft');
  expect(keys.quiet('KeyX')).toBe(true);
});

it('releases a leader held before Cmd went down when Cmd comes up', () => {
  const released: string[] = [];
  const stack = { open: () => [], holdOpened: () => true, release: (by: string) => released.push(by) } as unknown as KeymapStack;
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }), 'KeyA', () => {});
  keys.cmdDown();
  keys.up(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }), 'MetaLeft');
  expect(released).toEqual(['key:KeyA']);
});

it('keeps the repeats of a keystroke made inside a held keymap that stays open', () => {
  const stack = createKeymapStack();
  stack.push('nudge', 'Nudge', { heldBy: 'key:KeyA' });
  const keys = keymapKeys(() => stack);
  keys.press(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight' }), 'ArrowRight', () => {
    stack.batch(() => stack.inputSeen());
  });
  expect(stack.open().map((k) => k.id)).toEqual(['nudge']);
  expect(keys.quiet('ArrowRight')).toBe(false);
});
