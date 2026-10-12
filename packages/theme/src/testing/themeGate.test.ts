import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { THEME_SOURCES } from '../generated/themes';
import { defineTheme, type ThemeInput, weaselTheme } from '../theme';
import { BUILT_IN_PAIRINGS, gateFailures } from './themeGate';

const lookup = (name: string) => (name === 'weasel' ? THEME_SOURCES.weasel : undefined);

function failuresOf(pins: ThemeDefinition['pins']): string[] {
  const definition: ThemeDefinition = { name: 'probe', extends: 'weasel', pins };
  return gateFailures(defineTheme({ ...definition, extends: weaselTheme } as ThemeInput), definition, lookup, BUILT_IN_PAIRINGS);
}

describe('gateFailures', () => {
  it('passes the built-in theme on what it is already held to', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('names text that falls short of its ground, in the selection where it does', () => {
    const failures = failuresOf({ fg: { by: 'mode', light: { value: '#d0d0d0', type: 'color' } } });
    expect(failures.some((f) => /^mode=light,density=compact: fg on surface is 1\.\d\d:1, under 4\.5:1$/.test(f))).toBe(true);
    expect(failures.every((f) => f.startsWith('mode=light'))).toBe(true);
  });

  it('checks an emphasis step at its alpha over each ground, not the text it steps down from', () => {
    // #8a8a8a clears 4.5:1 on the dark surfaces as it stands and falls under it at the muted and subtle alphas.
    const failures = failuresOf({ fg: { by: 'mode', dark: { value: '#8a8a8a', type: 'color' } } });
    expect(failures.some((f) => f.includes(': fg on surface is'))).toBe(false);
    expect(failures.some((f) => f.includes(': fg-subtle on surface is'))).toBe(true);
  });

  it('refuses a paired token that is not a solid color', () => {
    const failures = failuresOf({ surface: { value: 'rgba(0, 0, 0, 0.5)', type: 'color' } });
    expect(failures).toContain('mode=dark,density=compact: surface is rgba(0, 0, 0, 0.5), not a solid color');
  });

  it('reports two ranks of the type ramp on one size', () => {
    const failures = failuresOf({ 'font-size-xs': { value: '{font-size-2xs}', type: 'dimension' } });
    expect(failures.some((f) => f.includes('the type ramp repeats a size'))).toBe(true);
  });
});
