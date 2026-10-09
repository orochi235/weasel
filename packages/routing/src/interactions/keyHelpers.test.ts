import { describe, expect, it } from 'vitest';
import { historyKey } from './keyHelpers';

const key = (k: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
  key: k,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
});

describe('historyKey', () => {
  it('reads Mod+Z as undo, on either modifier', () => {
    expect(historyKey(key('z', { meta: true }))).toBe('undo');
    expect(historyKey(key('z', { ctrl: true }))).toBe('undo');
  });

  it('reads Shift+Mod+Z and Mod+Y as redo', () => {
    expect(historyKey(key('Z', { meta: true, shift: true }))).toBe('redo');
    expect(historyKey(key('y', { ctrl: true }))).toBe('redo');
  });

  it('leaves everything else alone', () => {
    expect(historyKey(key('z'))).toBeNull();
    expect(historyKey(key('z', { meta: true, alt: true }))).toBeNull();
    expect(historyKey(key('s', { meta: true }))).toBeNull();
  });
});
