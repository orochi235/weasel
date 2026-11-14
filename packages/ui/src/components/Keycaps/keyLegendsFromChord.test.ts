import { describe, expect, it } from 'vitest';
import { keyLegendsFromChord } from './keyLegendsFromChord';

const labels = (chord: string, platform: 'macos' | 'windows') => keyLegendsFromChord(chord, { platform }).map((k) => k.label);

describe('keyLegendsFromChord', () => {
  it('reads Mod as the platform’s own modifier', () => {
    expect(labels('Mod+Shift+Z', 'macos')).toEqual(['⌘', '⇧', 'Z']);
    expect(labels('Mod+Shift+Z', 'windows')).toEqual(['Ctrl', '⇧', 'Z']);
  });

  it('reads a named key, a lone modifier, and the plus key', () => {
    expect(labels('Escape', 'windows')).toEqual(['Esc']);
    expect(labels('Alt', 'windows')).toEqual(['Alt']);
    expect(labels('Mod++', 'windows')).toEqual(['Ctrl', '+']);
  });
});
