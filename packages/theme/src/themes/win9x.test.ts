import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { THEME_SOURCES } from '../generated/themes';
import { resolveTheme, themeAxes } from '../resolveTheme';
import { gateFailures, TEXT_PAIRINGS } from '../testing/themeGate';
import { win9xTheme } from './win9x';
import definition from './win9x.theme.json' with { type: 'json' };

const lookup = (name: string) => (name === 'weasel' ? THEME_SOURCES.weasel : undefined);

describe('win9xTheme', () => {
  it('clears the gate in both modes at every density', () => {
    const pairings = [
      ...TEXT_PAIRINGS,
      { text: 'fg', on: ['button-surface', 'button-pressed-surface'], min: 4.5 },
      { text: 'button-confirm-fg', on: ['button-confirm-surface', 'button-confirm-pressed-surface'], min: 4.5 },
    ];
    expect(gateFailures(win9xTheme, definition as ThemeDefinition, lookup, pairings)).toEqual([]);
  });

  it('reads on both ends of its title strip', () => {
    for (const mode of ['light', 'dark']) {
      const tokens = resolveTheme(win9xTheme, { mode }) as Readonly<Record<string, string>>;
      expect(tokens['--wzl-titlebar-surface']).toBe('linear-gradient(90deg, #000080, #1084d0)');
      expect(tokens['--wzl-titlebar-fg']).toBe('#ffffff');
    }
  });

  it('opens in light mode, on weasel’s token set with its own modes and densities', () => {
    const axes = themeAxes(win9xTheme);
    expect(axes.mode.default).toBe('light');
    expect(Object.keys(axes.mode.values).sort()).toEqual(['dark', 'light']);
    expect(Object.keys(axes.density.values)).toEqual(['compact', 'comfortable', 'roomy']);
    const light = resolveTheme(win9xTheme);
    expect(light['--wzl-surface']).toBe('#c0c0c0');
    expect(light['--wzl-surface-sunken']).toBe('#ffffff');
    // Inherited from weasel: the theme changes values, not the token set.
    expect(light['--wzl-space-md']).toBe('12px');
  });

  it('squares every corner and steps its type and controls with density', () => {
    const at = (density: string) => resolveTheme(win9xTheme, { density }) as Readonly<Record<string, string>>;
    for (const name of ['radius-sm', 'radius-md', 'radius-lg', 'radius-pill', 'button-radius', 'panel-radius']) {
      expect(at('comfortable')[`--wzl-${name}`], name).toBe('0px');
    }
    expect(['compact', 'comfortable', 'roomy'].map((d) => at(d)['--wzl-font-size'])).toEqual(['11px', '12px', '14px']);
    expect(['compact', 'comfortable', 'roomy'].map((d) => at(d)['--wzl-control-h'])).toEqual(['21px', '23px', '28px']);
  });

  it('draws a raised face light above and dark below, and a well the other way up', () => {
    const tokens = resolveTheme(win9xTheme, { mode: 'light' }) as Readonly<Record<string, string>>;
    expect(tokens['--wzl-bevel-light']).toBe('#ffffff');
    expect(tokens['--wzl-bevel-dark']).toBe('#000000');
    expect(tokens['--wzl-bevel-raised']).toMatch(/^inset -1px -1px 0 var\(--wzl-bevel-dark\), inset 1px 1px 0 var\(--wzl-bevel-light\)/);
    expect(tokens['--wzl-bevel-sunken']).toMatch(/^inset -1px -1px 0 var\(--wzl-bevel-light\), inset 1px 1px 0 var\(--wzl-bevel-shade\)/);
  });
});
