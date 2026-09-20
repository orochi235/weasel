import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAKED_THEMES, THEME_SOURCES, THEMES } from './themes';
import { TOKEN_HOOKS } from '../hooks';
import { TOKEN_MANIFEST } from './manifest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'tokens.css'), 'utf8');

describe('generated themes.ts', () => {
  const dark = THEMES.weasel.selections['mode=dark,density=comfortable'];
  const light = THEMES.weasel.selections['mode=light,density=comfortable'];

  it('exposes every mode and density of the weasel theme', () => {
    expect(Object.keys(THEMES.weasel.selections).sort()).toEqual([
      'mode=dark,density=comfortable',
      'mode=dark,density=compact',
      'mode=dark,density=roomy',
      'mode=light,density=comfortable',
      'mode=light,density=compact',
      'mode=light,density=roomy',
    ]);
  });

  it('sizes the type ramp per density and leaves the spacing ladder alone', () => {
    const at = (d: 'compact' | 'comfortable' | 'roomy') => THEMES.weasel.selections[`mode=dark,density=${d}`];
    expect([at('compact'), at('comfortable'), at('roomy')].map((s) => s['--wzl-font-size-md'])).toEqual(['11px', '13px', '15px']);
    expect([at('compact'), at('comfortable'), at('roomy')].map((s) => s['--wzl-control-h'])).toEqual(['20px', '24px', '28px']);
    expect([at('compact'), at('comfortable'), at('roomy')].map((s) => s['--wzl-space-4'])).toEqual(['8px', '8px', '8px']);
  });

  it('resolves aliases to literals', () => {
    expect(dark['--wzl-surface']).toBe('#181a1e');
    expect(light['--wzl-surface']).toBe('#f5f5f6');
  });

  it('computes alpha tokens exactly instead of approximating them', () => {
    expect(dark['--wzl-line']).toBe('rgba(230, 231, 233, 0.2)');
    expect(light['--wzl-line']).toBe('rgba(14, 15, 18, 0.2)');
  });

  it('exposes the definition as authored, so references survive for extends and the editor', () => {
    expect((THEME_SOURCES.weasel.pins!.accent as { value: string }).value).toBe('{accent-base}');
    expect(Object.keys(THEME_SOURCES.weasel.semantics!)).toContain('surface');
    expect(BAKED_THEMES.weasel.tokens.accent).toMatchObject({ value: '{accent-base}' });
  });

  it('carries the token groups labkit contributed', () => {
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-z-modal']).toBe('30');
    expect(dark['--wzl-swatch-fuchsia']).toBe('#f641f7');
    expect(dark['--wzl-backdrop']).toBe('none');
    // Mode-invariant: the swatch set does not flip.
    expect(light['--wzl-swatch-fuchsia']).toBe('#f641f7');
    expect((THEME_SOURCES.weasel.pins!.backdrop as { type: string }).type).toBe('gradient');
  });

  it('flips accent-fg per mode', () => {
    expect(dark['--wzl-accent-fg']).toBe('#5841b8');
    expect(light['--wzl-accent-fg']).toBe('#2e1f7a');
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

  it('carries descriptions through for the CSS-vars panel', () => {
    const tb = TOKEN_MANIFEST.find((t) => t.name === '--wzl-tb-height');
    expect(tb?.description).toMatch(/toolbar/i);
  });

  it('carries every override hook, marked and described', () => {
    for (const hook of TOKEN_HOOKS) {
      const row = TOKEN_MANIFEST.find((t) => t.name === `--wzl-${hook.name}`);
      expect(row, hook.name).toMatchObject({
        hook: true,
        defaultValue: hook.value,
        description: hook.description,
      });
    }
    expect(TOKEN_MANIFEST.filter((t) => t.hook)).toHaveLength(TOKEN_HOOKS.length);
  });

  it('declares no hook in tokens.css', () => {
    // The whole contract: a `:root` declaration would outrank the in-CSS
    // fallback, and `check:token-reads` would stop requiring one. The manifest
    // is where a hook is declared; the stylesheet must stay silent about it.
    for (const hook of TOKEN_HOOKS) {
      expect(css, hook.name).not.toMatch(new RegExp(`--wzl-${hook.name}\\s*:`));
    }
  });
});
