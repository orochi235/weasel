import { describe, expect, it } from 'vitest';
import { keySpecsFromLegend } from './keySpecsFromLegend';

const labels = (legend: string) => keySpecsFromLegend(legend).map((k) => k.label);

describe('keySpecsFromLegend', () => {
  it('sets each modifier glyph apart from the key after it', () => {
    expect(labels('⌘Z')).toEqual(['⌘', 'Z']);
    expect(labels('⇧⌘Z')).toEqual(['⇧', '⌘', 'Z']);
    expect(labels('⌘,')).toEqual(['⌘', ',']);
  });

  it('keeps a named key whole, and a modifier pressed alone as the key', () => {
    expect(labels('Space')).toEqual(['Space']);
    expect(labels('⌘Enter')).toEqual(['⌘', 'Enter']);
    expect(labels('⇧')).toEqual(['⇧']);
  });

  it('splits modifiers spelled out and joined by a plus, and reads a lone plus as a key', () => {
    expect(labels('Ctrl+Shift+Z')).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(labels('+')).toEqual(['+']);
    expect(labels('⌘+')).toEqual(['⌘', '+']);
  });
});
