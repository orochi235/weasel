import { describe, expect, it } from 'vitest';
import { resolveStanceSlots } from './panel';

const base = { surface: '#111111', 'border-color': '#222222', 'title-color': '#333333', tone: '#111111' };

describe('resolveStanceSlots', () => {
  it('is the base look with no stance, whatever the theme declares', () => {
    const tokens = { '--wzl-stance-danger-border-color': '#ff0000' };
    expect(resolveStanceSlots(tokens, base)).toEqual(base);
  });

  it('reads a slot the stance declares and falls back to base for the rest', () => {
    const tokens = { '--wzl-stance-danger-border-color': '#ff0000', '--wzl-stance-danger-tone': '#ee0000' };
    expect(resolveStanceSlots(tokens, base, { stance: 'danger' })).toEqual({
      ...base,
      'border-color': '#ff0000',
      tone: '#ee0000',
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

  it('gives a stance with no tone of its own the surface, not the base tone', () => {
    const got = resolveStanceSlots({}, { ...base, tone: '#abcdef' }, { stance: 'debug' });
    expect(got.tone).toBe('#111111');
  });
});
