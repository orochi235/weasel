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

  it('reads Ctrl and Meta as modifiers, and keeps every key after them', () => {
    expect(labels('Ctrl+Z', 'windows')).toEqual(['Ctrl', 'Z']);
    expect(labels('Meta+K', 'macos')).toEqual(['⌘', 'K']);
    expect(labels('Mod+K+L', 'windows')).toEqual(['Ctrl', 'K', 'L']);
  });

  it('draws modifiers in one order, once each, with or without a key', () => {
    expect(labels('Shift+Mod', 'macos')).toEqual(['⌘', '⇧']);
    expect(labels('Mod+Mod', 'macos')).toEqual(['⌘']);
    expect(labels('Shift+Mod+Z', 'macos')).toEqual(['⌘', '⇧', 'Z']);
  });

  it('reads an empty chord as no keys', () => {
    expect(labels('', 'windows')).toEqual([]);
    expect(labels('  ', 'macos')).toEqual([]);
  });

  it('draws once a modifier that Mod and its platform key both name', () => {
    expect(labels('Mod+Ctrl+F', 'windows')).toEqual(['Ctrl', 'F']);
    expect(labels('Mod+Ctrl+F', 'macos')).toEqual(['⌘', '⌃', 'F']);
    expect(labels('Mod+Meta+K', 'macos')).toEqual(['⌘', 'K']);
    expect(keyLegendsFromChord('Mod+Ctrl+F', { platform: 'linux', legend: 'symbol' }).map((k) => k.label)).toEqual(['⎈', 'F']);
  });

  it('reads a part named like an Object.prototype member as the key, not a modifier', () => {
    expect(labels('Shift+constructor', 'windows')).toEqual(labels('Shift+x', 'windows').slice(0, -1).concat(['constructor']));
  });
});
