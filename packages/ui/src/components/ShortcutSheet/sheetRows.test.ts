import { describe, expect, it } from 'vitest';
import type { ShortcutRow } from '@weasel-js/routing';
import { rowMatches } from './sheetRows';

const UNDO: ShortcutRow = { id: 'undo', label: 'Undo', shortcuts: [{ key: 'z', mod: true }] };
const LOUPE_2: ShortcutRow = { id: 'loupe2', label: 'Zoom 200%', shortcuts: [{ key: '2', mod: true, leader: [{ label: 'Loupe', shortcut: { key: 'l', alt: true } }] }] };
const ZOOM_IN: ShortcutRow = { id: 'zoom', label: 'Zoom in', shortcuts: [{ key: '+', mod: true }] };

describe('rowMatches', () => {
  it('reads a `+` between spaces or at the end as joining keys, not as the plus key', () => {
    expect(rowMatches(UNDO, 'Ctrl + Z', 'linux')).toBe(true);
    expect(rowMatches(UNDO, 'Ctrl+', 'linux')).toBe(true);
    expect(rowMatches(UNDO, 'Ctrl +', 'linux')).toBe(true);
  });

  it('reads a `+` in key position as the plus key', () => {
    expect(rowMatches(ZOOM_IN, 'Ctrl++', 'linux')).toBe(true);
    expect(rowMatches(ZOOM_IN, '+', 'linux')).toBe(true);
    expect(rowMatches(UNDO, 'Ctrl++', 'linux')).toBe(false);
    expect(rowMatches(UNDO, '+', 'linux')).toBe(false);
  });

  it('finds a row by its leader keys together with its own', () => {
    expect(rowMatches(LOUPE_2, 'Alt+L Ctrl+2', 'linux')).toBe(true);
    expect(rowMatches(LOUPE_2, '⌥L ⌘2', 'macos')).toBe(true);
    expect(rowMatches(LOUPE_2, 'Shift+L Ctrl+2', 'linux')).toBe(false);
  });
});
