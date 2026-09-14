import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../definition';
import { bake } from '../bake';
import { axisDependencies } from '../deps';
import { derive } from '../derive';
import { cssValue, emitCss } from './css';
import { emitManifest } from './manifest';
import { emitThemes } from './themes';

const E: ThemeDefinition = {
  name: 'e',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  semantics: {
    surface: { by: 'mode', dark: { ref: 'ink', type: 'color', description: 'The page.' }, light: { ref: 'paper', type: 'color' } },
    gap: { by: 'density', comfortable: { value: '4px', type: 'dimension' }, compact: { value: '3px', type: 'dimension' } },
  },
  pins: {
    ink: { value: '#111111', type: 'color' },
    paper: { value: '#eeeeee', type: 'color' },
    line: { value: '{surface}', type: 'color', alpha: 0.2 },
    pad: { value: '{gap}', type: 'dimension' },
    'pad-edge': { by: 'mode', dark: { value: '{pad}', type: 'dimension' }, light: { value: '0px', type: 'dimension' } },
  },
};

const MODE = { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } } } as const;
const BASE_AXES = { ...MODE, density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } } as const;
const base: ThemeDefinition = {
  name: 'base',
  axes: BASE_AXES,
  semantics: { surface: { by: 'mode', dark: { ref: 'gray-900', type: 'color' }, light: { ref: 'gray-50', type: 'color' } } },
  pins: {
    'gray-50': { value: '#f5f5f5', type: 'color' },
    'gray-900': { value: '#111111', type: 'color' },
    'fg-on-accent': { value: '{gray-50}', type: 'color' },
    // Depends on both axes only through its reference chain (mode -> pad -> gap-by-density),
    // so a theme that overrides it with a flat literal narrows its own axis dependency.
    gap: { by: 'density', comfortable: { value: '10px', type: 'dimension' }, compact: { value: '6px', type: 'dimension' } },
    pad: { value: '{gap}', type: 'dimension' },
    'pad-edge': { by: 'mode', dark: { value: '{pad}', type: 'dimension' }, light: { value: '0px', type: 'dimension' } },
  },
};
const child: ThemeDefinition = { name: 'child', extends: 'base', pins: { 'gray-50': { value: '#ff0000', type: 'color' } } };
const grand: ThemeDefinition = {
  name: 'grand',
  extends: 'child',
  pins: { 'gray-900': { value: '#00ff00', type: 'color' }, 'pad-edge': { value: '7px', type: 'dimension' } },
};
// Explicit, not `{...base.pins, ...}`: aaa's own axes lack density, and spreading in base's
// density-varying pins would make it a theme that can't derive its own tokens standalone.
const aaa: ThemeDefinition = {
  name: 'aaa',
  axes: MODE,
  pins: {
    'gray-50': { value: '#f5f5f5', type: 'color' },
    'gray-900': { value: '#111111', type: 'color' },
    'fg-on-accent': { value: '{gray-50}', type: 'color' },
    surface: { value: '#123456', type: 'color' },
  },
};

const defs: Record<string, ThemeDefinition> = { base, child, grand, aaa };
const lookup = (n: string) => defs[n];
const input = (def: ThemeDefinition, isDefault = true) => ({ baked: bake(def, lookup), deps: axisDependencies(def, lookup), isDefault });
const css = emitCss([input(E)]);

type Attrs = Readonly<Record<string, string>>;

/** Custom properties as a browser computes them: `var()` substitutes where declared, and the result inherits. */
function computed(sheet: string, chain: readonly Attrs[]): Record<string, string> {
  const rules = [...sheet.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
    sels: m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({
      root: s.startsWith(':root'),
      attrs: [...s.matchAll(/\[data-wzl-([\w-]+)='([^']+)'\]/g)].map((p) => [p[1], p[2]] as const),
    })),
    decls: m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()] as const),
  }));
  let inherited: Record<string, string> = {};
  chain.forEach((attrs, depth) => {
    const winners = new Map<string, { spec: number; value: string }>();
    for (const r of rules) {
      const hits = r.sels.filter((s) => (!s.root || depth === 0) && s.attrs.every(([k, v]) => attrs[k] === v));
      if (hits.length === 0) continue;
      const spec = Math.max(...hits.map((s) => s.attrs.length + (s.root ? 1 : 0)));
      for (const [p, value] of r.decls) if (spec >= (winners.get(p)?.spec ?? -1)) winners.set(p, { spec, value });
    }
    const out = { ...inherited };
    const done = new Set<string>();
    const resolving = new Set<string>();
    const get = (p: string): string => {
      const w = winners.get(p);
      if (!w || done.has(p)) return out[p] ?? `<unset ${p}>`;
      if (resolving.has(p)) return '<cycle>';
      resolving.add(p);
      out[p] = w.value.replace(/var\((--[\w-]+)\)/g, (_, n: string) => get(n));
      done.add(p);
      return out[p];
    };
    for (const p of winners.keys()) get(p);
    inherited = out;
  });
  return inherited;
}

/** Every token `def` derives at the innermost element's selection that the sheet computes differently. */
function wrong(sheet: string, def: ThemeDefinition, chain: readonly Attrs[]): string[] {
  const sel = Object.fromEntries(Object.entries(chain[chain.length - 1]).filter(([k]) => k !== 'theme'));
  const { tokens } = derive(def, sel, lookup);
  const want = computed(`:root {\n${Object.entries(tokens).map(([n, t]) => `--wzl-${n}: ${cssValue(n, t)};`).join('\n')}\n}`, [{}]);
  const got = computed(sheet, chain);
  return Object.entries(want).filter(([p, v]) => got[p] !== v).map(([p, v]) => `${p}: got ${got[p]} want ${v}`);
}

describe('emitCss', () => {
  it('declares every token in :root, in order, with the default scheme and descriptions', () => {
    expect(css).toContain(':root {\n  color-scheme: dark;\n  /* The page. */\n  --wzl-surface: var(--wzl-ink);\n  --wzl-gap: 4px;\n');
    expect(css).toContain('  --wzl-line: color-mix(in srgb, var(--wzl-surface) 20%, transparent);\n');
  });

  it('writes a block per axis value: own values first, then what depends through a reference', () => {
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-mode='light'],\n[data-wzl-mode='light'] {\n  color-scheme: light;\n  --wzl-surface: var(--wzl-paper);\n  --wzl-line: color-mix(in srgb, var(--wzl-surface) 20%, transparent);\n}\n",
    );
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-density='compact'],\n[data-wzl-density='compact'] {\n  --wzl-gap: 3px;\n  --wzl-pad: var(--wzl-gap);\n}\n",
    );
  });

  it('puts a token that depends on two axes in the compound blocks only', () => {
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-mode='light'][data-wzl-density='compact'],\n[data-wzl-mode='light'][data-wzl-density='compact'] {\n  --wzl-pad-edge: 0px;\n}\n",
    );
    const single = css.split('\n\n').filter((b) => /^\[data-wzl-theme='e'\]\[data-wzl-\w+='\w+'\],/.test(b));
    expect(single.some((b) => b.includes('--wzl-pad-edge'))).toBe(false);
  });

  it('emits a lone default theme exactly as before other themes were diffed against it', () => {
    expect(css).toBe(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'e.tokens.css'), 'utf8'));
  });

  it('redeclares a token whose reference reaches something a child overrides', () => {
    const sheet = emitCss([input(base), input(child, false)]);
    for (const mode of ['dark', 'light']) {
      expect(computed(sheet, [{}, { theme: 'child', mode }])['--wzl-fg-on-accent']).toBe('#ff0000');
    }
  });

  it('keeps what a non-default parent overrides in its own child', () => {
    const sheet = emitCss([input(base), input(child, false), input(grand, false)]);
    const got = computed(sheet, [{}, { theme: 'grand', mode: 'dark' }]);
    expect(got['--wzl-gray-50']).toBe('#ff0000');
    expect(got['--wzl-gray-900']).toBe('#00ff00');
    expect(got['--wzl-surface']).toBe('#00ff00');
  });

  it('lets another theme outrank the default in whichever order the two are emitted', () => {
    for (const sheet of [emitCss([input(aaa, false), input(base)]), emitCss([input(base), input(aaa, false)])]) {
      expect(computed(sheet, [{}, { theme: 'aaa', mode: 'light' }])['--wzl-surface']).toBe('#123456');
      expect(computed(sheet, [{ theme: 'aaa', mode: 'light' }])['--wzl-surface']).toBe('#123456');
    }
  });

  it('resets the default theme inside a subtree of another theme', () => {
    const sheet = emitCss([input(base), input(child, false)]);
    const got = computed(sheet, [{}, { theme: 'child', mode: 'dark' }, { theme: 'base', mode: 'dark' }]);
    expect(got['--wzl-gray-50']).toBe('#f5f5f5');
    expect(got['--wzl-fg-on-accent']).toBe('#f5f5f5');
  });

  it('computes every token of every theme, at the root or nested, in either emission order', () => {
    const all = [base, child, grand, aaa];
    const sheets = [emitCss(all.map((d) => input(d, d === base))), emitCss([...all].reverse().map((d) => input(d, d === base)))];
    const failures: string[] = [];
    for (const sheet of sheets) {
      for (const def of all) {
        for (const mode of ['dark', 'light']) {
          for (const density of ['comfortable', 'compact']) {
            const el = { theme: def.name, mode, density };
            const chains = [[el], [{}, el], ...all.map((o) => [{}, { theme: o.name, mode, density }, el])];
            for (const chain of chains) failures.push(...wrong(sheet, def, chain).map((w) => `${JSON.stringify(chain)} ${w}`));
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('throws unless exactly one theme is the default', () => {
    expect(() => emitCss([input(base, false)])).toThrow(/exactly one default/);
    expect(() => emitCss([input(base), input(aaa)])).toThrow(/exactly one default/);
  });

  it('throws when more than one axis carries a color scheme', () => {
    const two: ThemeDefinition = {
      name: 'two',
      axes: { ...MODE, contrast: { default: 'low', values: { low: {}, high: { scheme: 'dark' } } } },
      pins: { a: { value: '1px', type: 'dimension' } },
    };
    expect(() => emitCss([input(two)])).toThrow(/color scheme/);
  });

  it('resets color-scheme for an axis value without one when its siblings have one', () => {
    const dim: ThemeDefinition = {
      name: 'dim',
      axes: { mode: { default: 'dim', values: { dim: {}, light: { scheme: 'light' } } } },
      pins: { fg: { by: 'mode', dim: { value: '#999999', type: 'color' }, light: { value: '#000000', type: 'color' } } },
    };
    const sheet = emitCss([input(dim)]);
    expect(computed(sheet, [{}, { mode: 'light' }, { mode: 'dim' }])['color-scheme']).toBe('normal');
  });

  it('scopes a theme lacking an axis value to the scheme of its own default value, not a reset to normal', () => {
    const withHc: ThemeDefinition = {
      name: 'withHc',
      axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' }, hc: { scheme: 'dark' } } } },
      pins: { fg: { by: 'mode', dark: { value: '#eeeeee', type: 'color' }, light: { value: '#111111', type: 'color' }, hc: { value: '#ffffff', type: 'color' } } },
    };
    // No `hc`: falls back to the default's tokens for it, and should fall back to the default's scheme too.
    const other: ThemeDefinition = {
      name: 'other',
      axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } } },
      pins: { fg: { by: 'mode', dark: { value: '#cccccc', type: 'color' }, light: { value: '#333333', type: 'color' } } },
    };
    const sheet = emitCss([input(withHc), input(other, false)]);
    expect(computed(sheet, [{}, { theme: 'other', mode: 'hc' }])['color-scheme']).toBe('dark');
  });
});

describe('emitManifest', () => {
  it('lists the default theme’s tokens in order with resolved default values', () => {
    const text = emitManifest(input(E));
    expect(text).toContain("  { name: '--wzl-surface', type: \"color\", group: \"surface\", defaultValue: \"#111111\", description: \"The page.\" },");
    expect(text.indexOf("'--wzl-surface'")).toBeLessThan(text.indexOf("'--wzl-ink'"));
  });
});

describe('emitThemes', () => {
  it('resolves every selection and carries the definition and the baked form', () => {
    const text = emitThemes([{ definition: E, baked: bake(E) }]);
    expect(text).toContain("'mode=light,density=compact'");
    expect(text).toContain("'--wzl-pad-edge': \"0px\"");
    expect(text).toContain('export const THEME_SOURCES');
    expect(text).toContain('export const BAKED_THEMES');
    expect(text).toMatch(/export type TokenName =\n {2}\| '--wzl-gap'/);
  });
});
