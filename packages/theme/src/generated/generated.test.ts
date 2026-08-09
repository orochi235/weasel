import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './themes';
import { TOKEN_MANIFEST } from './manifest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8');

describe('generated themes.ts', () => {
  it('exposes both modes of the weasel theme', () => {
    expect(Object.keys(THEMES.weasel.modes).sort()).toEqual(['dark', 'light']);
  });

  it('resolves aliases to literals', () => {
    expect(THEMES.weasel.modes.dark['--wzl-surface']).toBe('#181a1e');
    expect(THEMES.weasel.modes.light['--wzl-surface']).toBe('#f5f5f6');
  });

  it('computes alpha tokens exactly instead of approximating them', () => {
    expect(THEMES.weasel.modes.dark['--wzl-line']).toBe('rgba(230, 231, 233, 0.2)');
    expect(THEMES.weasel.modes.light['--wzl-line']).toBe('rgba(14, 15, 18, 0.2)');
  });

  it('exposes unresolved sources so extends can rebase aliases', async () => {
    const { THEME_SOURCES } = await import('./themes');
    // --wzl-accent is an alias, not a literal, in the source form.
    expect(THEME_SOURCES.weasel.primitives['accent'].value).toBe('{color.accent-base}');
    // Mode layers carry only what differs.
    expect(Object.keys(THEME_SOURCES.weasel.modes.dark)).toContain('surface');
    expect(Object.keys(THEME_SOURCES.weasel.modes.dark)).not.toContain('gray-50');
  });

  it('flips accent-fg per mode', () => {
    expect(THEMES.weasel.modes.dark['--wzl-accent-fg']).toBe('#5841b8');
    expect(THEMES.weasel.modes.light['--wzl-accent-fg']).toBe('#2e1f7a');
  });
});

describe('generated tokens.css', () => {
  it('emits color-mix for alpha tokens so DOM overrides still tint', () => {
    expect(css).toContain('--wzl-line: color-mix(in srgb, var(--wzl-fg) 20%, transparent);');
  });

  it('keeps var() indirection rather than inlining literals', () => {
    expect(css).toContain('--wzl-surface: var(--wzl-gray-800);');
  });

  it('emits a color-scheme per mode', () => {
    expect(css).toMatch(/\[data-wzl-mode='light'\][\s\S]*color-scheme: light;/);
  });

  it('carries no remote @import', () => {
    expect(css).not.toContain('@import');
  });
});

describe('generated manifest.ts', () => {
  it('lists every token with its type and group', () => {
    const line = TOKEN_MANIFEST.find((t) => t.name === '--wzl-line');
    expect(line).toMatchObject({ type: 'color', group: 'line' });
  });

  it('carries descriptions through for the Storybook panel', () => {
    const tb = TOKEN_MANIFEST.find((t) => t.name === '--wzl-tb-height');
    expect(tb?.description).toMatch(/toolbar/i);
  });
});
