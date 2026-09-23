import { describe, expect, it } from 'vitest';
import { keySpecsFromShortcut } from './keySpecsFromShortcut';

describe('keySpecsFromShortcut', () => {
  it('returns undefined for no shortcut, so KeySequence shows its empty dash', () => {
    expect(keySpecsFromShortcut(undefined)).toBeUndefined();
  });

  it('renders mod, shift, alt then the key, in macOS glyphs', () => {
    expect(keySpecsFromShortcut({ key: 'z', mod: true, shift: true, alt: true }, { platform: 'macos' }))
      .toEqual([{ label: '⌘' }, { label: '⇧' }, { label: '⌥' }, { label: 'Z' }]);
  });

  it('spells modifiers and named keys the way the platform prints them', () => {
    expect(keySpecsFromShortcut({ key: 'Escape', mod: true, alt: true }, { platform: 'windows' }))
      .toEqual([{ label: 'Ctrl' }, { label: 'Alt' }, { label: 'Esc' }]);
    expect(keySpecsFromShortcut({ key: 'Enter' }, { platform: 'macos', legend: 'text' }))
      .toEqual([{ label: 'Return' }]);
  });

  it('marks an optional shift as an optional key instead of dropping it', () => {
    expect(keySpecsFromShortcut({ key: 'r', shift: 'optional' }, { platform: 'macos' }))
      .toEqual([{ label: '⇧', optional: true }, { label: 'R' }]);
  });

  it('uses the first key of a key list', () => {
    expect(keySpecsFromShortcut({ key: ['Delete', 'Backspace'] }, { platform: 'macos' }))
      .toEqual([{ label: '⌦' }]);
  });
});
