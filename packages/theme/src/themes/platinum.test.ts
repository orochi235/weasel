import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { THEME_SOURCES } from '../generated/themes';
import { resolveTheme, themeAxes } from '../resolveTheme';
import { gateFailures, TEXT_PAIRINGS } from '../testing/themeGate';
import classic from './mac-classic.theme.json' with { type: 'json' };
import { classicMacTheme, platinumTheme } from './platinum';
import definition from './platinum.theme.json' with { type: 'json' };

const sources: Record<string, ThemeDefinition> = { weasel: THEME_SOURCES.weasel, 'mac-classic': classic as ThemeDefinition };
const lookup = (name: string) => sources[name];

describe('platinumTheme', () => {
  it('clears the gate in both modes at every density', () => {
    const pairings = [
      ...TEXT_PAIRINGS,
      { text: 'fg', on: ['button-surface', 'button-pressed-surface'], min: 4.5 },
      { text: 'button-confirm-fg', on: ['button-confirm-surface', 'button-confirm-pressed-surface'], min: 4.5 },
      { text: 'titlebar-fg', on: ['titlebar-label-surface'], min: 4.5 },
    ];
    expect(gateFailures(platinumTheme, definition as ThemeDefinition, lookup, pairings)).toEqual([]);
  });

  it('opens in light mode, with weasel’s densities', () => {
    const axes = themeAxes(platinumTheme);
    expect(axes.mode.default).toBe('light');
    expect(Object.keys(axes.density.values)).toEqual(['compact', 'comfortable', 'roomy']);
    const light = resolveTheme(platinumTheme);
    expect(light['--wzl-surface']).toBe('#dddddd');
    expect(light['--wzl-surface-sunken']).toBe('#ffffff');
    expect(light['--wzl-space-md']).toBe('12px');
  });

  it('centers a pinstriped window title on a patch of the face', () => {
    const light = resolveTheme(platinumTheme, { mode: 'light' }) as Readonly<Record<string, string>>;
    expect(light['--wzl-titlebar-align']).toBe('center');
    expect(light['--wzl-titlebar-surface']).toContain('repeating-linear-gradient(180deg, #ffffff 0 1px, #999999 1px 2px)');
    expect(light['--wzl-titlebar-label-surface']).toBe('#dddddd');
    const dark = resolveTheme(platinumTheme, { mode: 'dark' }) as Readonly<Record<string, string>>;
    expect(dark['--wzl-titlebar-surface']).toContain('repeating-linear-gradient(180deg, #5a5a5a 0 1px, #161616 1px 2px)');
    expect(dark['--wzl-titlebar-label-surface']).toBe('#2c2c2c');
  });

  it('rounds a button and squares a window and a field', () => {
    const tokens = resolveTheme(platinumTheme) as Readonly<Record<string, string>>;
    expect(tokens['--wzl-button-radius']).toBe('4px');
    expect(tokens['--wzl-panel-radius']).toBe('0px');
    expect(tokens['--wzl-radius-sm']).toBe('0px');
  });
});

describe('classicMacTheme', () => {
  it('holds what an era shares and none of its colors, so another era extends it beside Platinum', () => {
    expect(platinumTheme.extends).toBe(classicMacTheme);
    const colors = Object.entries(classicMacTheme.tokens).filter(([, token]) => JSON.stringify(token).includes('#'));
    expect(colors).toEqual([]);
    // What Platinum adds is color and edge alone: every name it pins is one of these kinds.
    const kinds = /^(surface|fg|border|accent|secondary|danger|warning|success|info|shadow|backdrop|workspace|code|bevel|field-focus|button-(confirm-)?(pressed-surface|bevel)|titlebar-(surface|fg|label-surface))/;
    expect(Object.keys(platinumTheme.tokens).filter((name) => !kinds.test(name))).toEqual([]);
  });

  it('derives with no issues on its own, in the built-in theme’s colors', () => {
    expect(gateFailures(classicMacTheme, classic as ThemeDefinition, lookup, [])).toEqual([]);
    expect(resolveTheme(classicMacTheme, { mode: 'dark' })['--wzl-font-size']).toBe('13px');
  });
});
