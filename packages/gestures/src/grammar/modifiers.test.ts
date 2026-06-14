import { describe, it, expect } from 'vitest';
import { mods, type ModifierCombo } from './modifiers';

describe('mods() helper', () => {
  it('no args returns "default"', () => {
    expect(mods()).toBe('default');
  });

  it('single modifier returns that key', () => {
    expect(mods('mod')).toBe('mod');
    expect(mods('shift')).toBe('shift');
    expect(mods('alt')).toBe('alt');
  });

  it('canonicalizes order regardless of input order', () => {
    expect(mods('alt', 'shift')).toBe('shift+alt');
    expect(mods('shift', 'alt')).toBe('shift+alt');
    expect(mods('shift', 'mod')).toBe('mod+shift');
    expect(mods('mod', 'shift')).toBe('mod+shift');
    expect(mods('alt', 'mod')).toBe('mod+alt');
  });

  it('three modifiers in any order canonicalize', () => {
    expect(mods('alt', 'shift', 'mod')).toBe('mod+shift+alt');
    expect(mods('mod', 'shift', 'alt')).toBe('mod+shift+alt');
    expect(mods('shift', 'alt', 'mod')).toBe('mod+shift+alt');
  });

  it('duplicates collapse', () => {
    expect(mods('shift', 'shift')).toBe('shift');
  });

  it('ModifierCombo type accepts only valid keys', () => {
    const valid: ModifierCombo[] = [
      'default',
      'mod', 'shift', 'alt',
      'mod+shift', 'mod+alt', 'shift+alt',
      'mod+shift+alt',
    ];
    expect(valid).toHaveLength(8);
  });
});
