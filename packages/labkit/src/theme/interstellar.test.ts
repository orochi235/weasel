import { resolveTheme, THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { interstellarTheme } from './interstellar';
import definition from './interstellar.theme.json' with { type: 'json' };

describe('interstellarTheme', () => {
  it('derives as a definition extending weasel with no issues', () => {
    const lookup = (name: string) => (name === 'weasel' ? THEME_SOURCES.weasel : undefined);
    for (const mode of ['dark', 'light']) {
      expect(derive(definition as ThemeDefinition, { mode }, lookup).issues, mode).toEqual([]);
    }
  });

  it('extends weasel and resolves both modes', () => {
    const dark = resolveTheme(interstellarTheme, { mode: 'dark' });
    const light = resolveTheme(interstellarTheme, { mode: 'light' });

    // Values carried over verbatim from the retired Less.
    expect(dark['--wzl-surface']).toBe('#0a0a14');
    expect(dark['--wzl-accent']).toBe('#b08adb');
    expect(light['--wzl-surface']).toBe('#fafaf7');
    expect(light['--wzl-accent']).toBe('#a86f3c');

    // Inherited from weasel — interstellar overrides values, not the token set.
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-swatch-teal']).toBe('#3ee1cb');

    // Deliberate divergences from the base.
    expect(dark['--wzl-radius-md']).toBe('6px');
    expect(dark['--wzl-font-weight-light']).toBe('300');
    expect(dark['--wzl-glass-blur']).toBe('12px');
  });

  it('carries the cosmic backdrop in dark and drops it in light', () => {
    expect(resolveTheme(interstellarTheme, { mode: 'dark' })['--wzl-backdrop']).toContain(
      'radial-gradient',
    );
    expect(resolveTheme(interstellarTheme, { mode: 'light' })['--wzl-backdrop']).toBe('none');
  });
});
