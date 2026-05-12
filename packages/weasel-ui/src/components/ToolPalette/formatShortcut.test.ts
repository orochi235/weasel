import { describe, it, expect } from 'vitest';
import { formatShortcut } from './formatShortcut';

describe('formatShortcut', () => {
  it('returns undefined for undefined input', () => {
    expect(formatShortcut(undefined)).toBeUndefined();
  });

  it('formats a plain key', () => {
    expect(formatShortcut({ key: 'v' })).toBe('V');
  });

  it('formats mod + key', () => {
    expect(formatShortcut({ key: 'z', mod: true })).toBe('⌘Z');
  });

  it('formats shift + key', () => {
    expect(formatShortcut({ key: 'h', shift: true })).toBe('⇧H');
  });

  it('formats alt + key', () => {
    expect(formatShortcut({ key: 'r', alt: true })).toBe('⌥R');
  });

  it('formats mod + shift + key in canonical order', () => {
    expect(formatShortcut({ key: 'z', mod: true, shift: true })).toBe('⌘⇧Z');
  });

  it('formats mod + shift + alt + key', () => {
    expect(formatShortcut({ key: 'x', mod: true, shift: true, alt: true })).toBe('⌘⇧⌥X');
  });

  it('uppercases the key character', () => {
    expect(formatShortcut({ key: 'a' })).toBe('A');
    expect(formatShortcut({ key: 'A' })).toBe('A');
  });
});
