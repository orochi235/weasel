import { describe, it, expect, vi } from 'vitest';
import { formatShortcut, formatShortcutParts } from './formatShortcut';

const mac = { platform: 'macos' } as const;

describe('formatShortcut', () => {
  it('returns undefined for undefined input', () => {
    expect(formatShortcut(undefined)).toBeUndefined();
  });

  it('formats a plain key', () => {
    expect(formatShortcut({ key: 'v' }, mac)).toBe('V');
  });

  it('formats mod + key', () => {
    expect(formatShortcut({ key: 'z', mod: true }, mac)).toBe('⌘Z');
  });

  it('formats shift + key', () => {
    expect(formatShortcut({ key: 'h', shift: true }, mac)).toBe('⇧H');
  });

  it('formats alt + key', () => {
    expect(formatShortcut({ key: 'r', alt: true }, mac)).toBe('⌥R');
  });

  it('formats mod + shift + key in canonical order', () => {
    expect(formatShortcut({ key: 'z', mod: true, shift: true }, mac)).toBe('⌘⇧Z');
  });

  it('formats mod + shift + alt + key', () => {
    expect(formatShortcut({ key: 'x', mod: true, shift: true, alt: true }, mac)).toBe('⌘⇧⌥X');
  });

  it('uppercases the key character', () => {
    expect(formatShortcut({ key: 'a' }, mac)).toBe('A');
    expect(formatShortcut({ key: 'A' }, mac)).toBe('A');
  });

  it('draws mod as Ctrl off macOS, the key the dispatcher matches there', () => {
    for (const platform of ['windows', 'linux'] as const) {
      expect(formatShortcut({ key: ',', mod: true }, { platform })).toBe('Ctrl+,');
      expect(formatShortcut({ key: 'z', mod: true, shift: true, alt: true }, { platform })).toBe('Ctrl+Shift+Alt+Z');
      expect(formatShortcut({ key: 'Escape' }, { platform })).toBe('Esc');
    }
  });

  it('reads the platform when given none', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: '' });
    expect(formatShortcut({ key: 'z', mod: true })).toBe('Ctrl+Z');
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(formatShortcut({ key: 'z', mod: true })).toBe('⌘Z');
    vi.unstubAllGlobals();
  });

  it('treats an optional shift as absent', () => {
    expect(formatShortcut({ key: 'z', shift: 'optional' }, mac)).toBe('Z');
  });

  it('draws the keymaps leading to a key before it, outermost first', () => {
    expect(formatShortcut(nested, mac)).toBe('View ▸ Loupe ▸ ⌘2');
    expect(formatShortcut(nested, { platform: 'windows' })).toBe('View ▸ Loupe ▸ Ctrl+2');
  });
});

const nested = {
  key: '2',
  mod: true,
  leader: [
    { label: 'View', shortcut: { key: 'v', alt: true } },
    { label: 'Loupe', shortcut: { key: 'l' } },
  ],
};

describe('formatShortcutParts', () => {
  it('returns undefined for undefined input', () => {
    expect(formatShortcutParts(undefined)).toBeUndefined();
  });

  it('gives one chip per key in the platform legend, and no leader for a key outside a keymap', () => {
    expect(formatShortcutParts({ key: 'z', mod: true, shift: true }, mac)).toEqual({
      leader: [],
      keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'Z' }],
    });
    expect(formatShortcutParts({ key: 'z', mod: true, alt: true }, { platform: 'windows' })?.keys.map((k) => k.label))
      .toEqual(['Ctrl', 'Alt', 'Z']);
  });

  it('marks an optional shift as an optional chip', () => {
    expect(formatShortcutParts({ key: 'z', shift: 'optional' }, mac)?.keys).toEqual([
      { label: '⇧', optional: true },
      { label: 'Z' },
    ]);
  });

  it('gives each keymap leading to the key, outermost first, by its label and its leader key', () => {
    expect(formatShortcutParts(nested, mac)).toEqual({
      leader: [
        { label: 'View', keys: [{ label: '⌥' }, { label: 'V' }] },
        { label: 'Loupe', keys: [{ label: 'L' }] },
      ],
      keys: [{ label: '⌘' }, { label: '2' }],
    });
  });

  it('spells the keys out in the text legend when asked', () => {
    expect(formatShortcutParts({ key: 'Escape' }, { platform: 'windows', legend: 'text' })?.keys).toEqual([{ label: 'Esc' }]);
  });
});
