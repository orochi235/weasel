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

  it('carries the token groups labkit contributed', async () => {
    const { THEME_SOURCES } = await import('./themes');
    const dark = THEMES.weasel.modes.dark;
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-z-modal']).toBe('30');
    expect(dark['--wzl-swatch-cyan']).toBe('#00dfff');
    expect(dark['--wzl-backdrop']).toBe('none');
    // Mode-invariant: the swatch set does not flip.
    expect(THEMES.weasel.modes.light['--wzl-swatch-cyan']).toBe('#00dfff');
    expect(THEME_SOURCES.weasel.primitives['backdrop'].type).toBe('gradient');
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

  // Without this, a surface that never calls `applyTheme` renders the dark
  // palette with light native widgets — the range track and scrollbar of the
  // other theme.
  it('gives :root the default mode scheme, not only the mode blocks', () => {
    expect(css).toMatch(/^:root \{\n {2}color-scheme: dark;/m);
  });

  it('carries no remote @import', () => {
    expect(css).not.toContain('@import');
  });

  // CSS substitutes a var() inside a *custom property* at the scope where that
  // property is declared, not where it is used. So a `:root` token referencing
  // a mode-varying one freezes at the default mode's value and inherits that
  // frozen value into every other mode's block. The only fix is to redeclare it
  // inside each mode block, where the reference resolves against that mode.
  it('redeclares every mode-dependent token inside every mode block', () => {
    const blocks = parseBlocks(css);
    const root = blocks.find((b) => b.selector === ':root' && b.decls.size > 1)!;
    const modes = blocks.filter((b) => b.selector.includes('data-wzl-mode'));
    expect(modes.length).toBeGreaterThan(1);

    // Names any mode block declares are the ones whose value depends on mode.
    const modeVarying = new Set(modes.flatMap((b) => [...b.decls.keys()]));

    const frozen: string[] = [];
    for (const [name, value] of root.decls) {
      const refs = [...value.matchAll(/var\((--wzl-[\w-]+)\)/g)].map((m) => m[1]);
      if (!refs.some((r) => modeVarying.has(r))) continue;
      for (const b of modes) {
        if (!b.decls.has(name)) frozen.push(`${name} missing from ${b.selector}`);
      }
    }
    expect(frozen).toEqual([]);
  });
});

/** Split a stylesheet into `{ selector, decls }`, keeping only custom
 *  properties. Good enough for the generated file, which has no nesting. */
function parseBlocks(text: string): { selector: string; decls: Map<string, string> }[] {
  const out: { selector: string; decls: Map<string, string> }[] = [];
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decls = new Map<string, string>();
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls.set(d[1], d[2].trim());
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), decls });
  }
  return out;
}

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
