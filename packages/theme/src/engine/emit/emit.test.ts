import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../definition';
import { bake } from '../bake';
import { axisDependencies } from '../deps';
import { emitCss } from './css';
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

const input = (def: ThemeDefinition, isDefault = true) => ({ baked: bake(def), deps: axisDependencies(def), isDefault });
const css = emitCss([input(E)]);

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

  it('gives a non-default theme no :root and a theme-scoped selector only', () => {
    const other = emitCss([input({ ...E, name: 'o' }, false)]);
    expect(other).not.toContain(':root');
    expect(other).toContain("[data-wzl-theme='o'][data-wzl-mode='light'] {\n");
    expect(other).toContain("[data-wzl-theme='o'] {\n  --wzl-ink: #111111;\n  --wzl-paper: #eeeeee;\n}\n");
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
