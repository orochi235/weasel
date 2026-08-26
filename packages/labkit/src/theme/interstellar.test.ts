import { resolveTheme } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { interstellarTheme } from './interstellar';

describe('interstellarTheme', () => {
  it('extends weasel and resolves both modes', () => {
    const dark = resolveTheme(interstellarTheme, 'dark');
    const light = resolveTheme(interstellarTheme, 'light');

    // Values carried over verbatim from the retired Less.
    expect(dark['--wzl-surface']).toBe('#0a0a14');
    expect(dark['--wzl-accent']).toBe('#b08adb');
    expect(light['--wzl-surface']).toBe('#fafaf7');
    expect(light['--wzl-accent']).toBe('#a86f3c');

    // Inherited from weasel — interstellar overrides values, not the token set.
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-swatch-cyan']).toBe('#00dfff');
    expect(dark['--wzl-font-weight-medium']).toBe('500');

    // Deliberate divergences from the base.
    expect(dark['--wzl-radius-md']).toBe('6px');
    expect(dark['--wzl-glass-blur']).toBe('12px');
  });

  it('carries the cosmic backdrop in dark and drops it in light', () => {
    expect(resolveTheme(interstellarTheme, 'dark')['--wzl-backdrop']).toContain('radial-gradient');
    expect(resolveTheme(interstellarTheme, 'light')['--wzl-backdrop']).toBe('none');
  });
});
