import { describe, expect, it } from 'vitest';
import { resolveStanceSlots } from './panel';

const base = { surface: '#111111', 'border-color': '#222222', 'title-color': '#333333', tint: '#111111' };

describe('resolveStanceSlots', () => {
  it('is the base look with no stance, whatever the theme declares', () => {
    const tokens = { '--wzl-stance-debug-border-color': '#ff0000' };
    expect(resolveStanceSlots(tokens, base)).toEqual(base);
  });

  it('reads a slot the stance declares and falls back to base for the rest', () => {
    const tokens = { '--wzl-stance-debug-border-color': '#ff0000', '--wzl-stance-debug-tint': '#ee0000' };
    expect(resolveStanceSlots(tokens, base, { stance: 'debug' })).toEqual({
      ...base,
      'border-color': '#ff0000',
      tint: '#ee0000',
    });
  });

  it('prefers the stanced fallback over base, and a nested slot over both', () => {
    const tokens = { '--wzl-stance-aside-nested-surface': '#444444' };
    const got = resolveStanceSlots(tokens, base, {
      stance: 'aside',
      nested: true,
      stanced: { surface: '#555555', 'title-color': '#666666' },
    });
    expect(got.surface).toBe('#444444');
    expect(got['title-color']).toBe('#666666');
  });

  it('gives a stance with no tint of its own the surface, not the base tint', () => {
    const got = resolveStanceSlots({}, { ...base, tint: '#abcdef' }, { stance: 'debug' });
    expect(got.tint).toBe('#111111');
  });
});
