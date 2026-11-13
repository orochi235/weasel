import { describe, expect, it } from 'vitest';
import { historyKey, matchesKeyBinding } from './keyHelpers';

const key = (k: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
  key: k,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
});

const MAC = true;
const PC = false;

describe('matchesKeyBinding', () => {
  it('reads mod as Cmd on a Mac, and Ctrl there does not fire it', () => {
    expect(matchesKeyBinding(key('d', { meta: true }), { key: 'd', mod: true }, MAC)).toBe(true);
    expect(matchesKeyBinding(key('d', { ctrl: true }), { key: 'd', mod: true }, MAC)).toBe(false);
    expect(matchesKeyBinding(key('d', { meta: true, ctrl: true }), { key: 'd', mod: true }, MAC)).toBe(false);
  });

  it('reads mod as Ctrl elsewhere, and Meta there does not fire it', () => {
    expect(matchesKeyBinding(key('d', { ctrl: true }), { key: 'd', mod: true }, PC)).toBe(true);
    expect(matchesKeyBinding(key('d', { meta: true }), { key: 'd', mod: true }, PC)).toBe(false);
  });

  it('forbids both platform keys on a binding without mod', () => {
    for (const platform of [MAC, PC]) {
      expect(matchesKeyBinding(key('d'), { key: 'd' }, platform)).toBe(true);
      expect(matchesKeyBinding(key('d', { meta: true }), { key: 'd' }, platform)).toBe(false);
      expect(matchesKeyBinding(key('d', { ctrl: true }), { key: 'd' }, platform)).toBe(false);
    }
  });

  it('keeps the alt and shift policies', () => {
    expect(matchesKeyBinding(key('d', { alt: true }), { key: 'd', alt: true }, PC)).toBe(true);
    expect(matchesKeyBinding(key('d'), { key: 'd', alt: true }, PC)).toBe(false);
    expect(matchesKeyBinding(key('D', { shift: true }), { key: 'd' }, PC)).toBe(false);
    expect(matchesKeyBinding(key('D', { shift: true }), { key: 'd', shift: 'optional' }, PC)).toBe(true);
    expect(matchesKeyBinding(key('d'), { key: 'd', shift: 'optional' }, PC)).toBe(true);
    expect(matchesKeyBinding(key('d'), { key: ['x', 'd'] }, PC)).toBe(true);
  });

  it('matches a chord on a non-Latin layout by the letter its key bears, as the dispatcher does', () => {
    // A Russian layout reports Ctrl+S as Ctrl+ы.
    expect(matchesKeyBinding({ ...key('ы', { ctrl: true }), code: 'KeyS' }, { key: 's', mod: true }, PC)).toBe(true);
    // Alone, the key is what it typed.
    expect(matchesKeyBinding({ ...key('ы'), code: 'KeyS' }, { key: 's' }, PC)).toBe(false);
  });
});

describe('historyKey', () => {
  it('reads Mod+Z as undo, with the platform key only', () => {
    expect(historyKey(key('z', { meta: true }), MAC)).toBe('undo');
    expect(historyKey(key('z', { ctrl: true }), MAC)).toBeNull();
    expect(historyKey(key('z', { ctrl: true }), PC)).toBe('undo');
    expect(historyKey(key('z', { meta: true }), PC)).toBeNull();
  });

  it('reads Shift+Mod+Z and Mod+Y as redo', () => {
    expect(historyKey(key('Z', { meta: true, shift: true }), MAC)).toBe('redo');
    expect(historyKey(key('y', { ctrl: true }), PC)).toBe('redo');
  });

  it('reads the Z and Y keys on a non-Latin layout, which report the character they type', () => {
    // Russian: Z types я, Y types н. Hebrew: Z types ז.
    expect(historyKey({ ...key('я', { meta: true }), code: 'KeyZ' }, MAC)).toBe('undo');
    expect(historyKey({ ...key('Я', { meta: true, shift: true }), code: 'KeyZ' }, MAC)).toBe('redo');
    expect(historyKey({ ...key('н', { ctrl: true }), code: 'KeyY' }, PC)).toBe('redo');
    expect(historyKey({ ...key('ז', { ctrl: true }), code: 'KeyZ' }, PC)).toBe('undo');
    // AZERTY types z on the W key, and is read by what it typed.
    expect(historyKey({ ...key('z', { ctrl: true }), code: 'KeyW' }, PC)).toBe('undo');
  });

  it('leaves everything else alone', () => {
    expect(historyKey(key('z'), MAC)).toBeNull();
    expect(historyKey(key('z', { meta: true, alt: true }), MAC)).toBeNull();
    expect(historyKey(key('s', { meta: true }), MAC)).toBeNull();
  });
});
