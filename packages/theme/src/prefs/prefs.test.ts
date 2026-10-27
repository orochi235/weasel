import { checkPrefSplits, openPrefsSync, prefLeaves, type PrefGroup, type PrefNumber } from '@weasel-js/prefs';
import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../resolveTheme';
import { defineTheme, weaselTheme } from '../theme';
import { themeFromPrefs, themePrefsPins, themePrefsSelection, themePrefsValues } from './pins';
import { themePrefsReferences, themePrefsSchema } from './schema';

const open = (schema: PrefGroup) => openPrefsSync(schema, { storage: createMemoryAdapter(), prefix: 't.' });

const SCHEMA = themePrefsSchema(weaselTheme);
const LEAVES = prefLeaves(SCHEMA);

describe('themePrefsSchema', () => {
  it('holds an enum for each axis, set to its default', () => {
    expect(LEAVES.get('axis.mode')).toMatchObject({ kind: 'enum', default: 'dark', options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] });
    expect(LEAVES.get('axis.density')).toMatchObject({ kind: 'enum', default: 'comfortable' });
  });

  it('holds a leaf for every token and hook, each split by every axis', () => {
    const tokens = new Set([...LEAVES.keys()].map((path) => `--wzl-${path.slice(path.indexOf('.') + 1)}`));
    for (const name of Object.keys(resolveTheme(weaselTheme))) expect(tokens.has(name), name).toBe(true);
    expect(LEAVES.has('status.danger')).toBe(true);
    expect(LEAVES.get('swatch.swatch-size')).toMatchObject({ kind: 'number', default: 28 });
    for (const [path, leaf] of LEAVES) {
      if (!path.startsWith('axis.')) expect(leaf.splitBy, path).toEqual(['axis.mode', 'axis.density']);
    }
    expect(checkPrefSplits(SCHEMA)).toEqual([]);
  });

  it('edits a color as hex, a dimension as a number in its unit, and anything else as CSS text', () => {
    expect(LEAVES.get('gray.gray-50')).toMatchObject({ kind: 'color', alpha: true, default: '#f5f5f6' });
    expect(LEAVES.get('motion.motion-fast')).toMatchObject({ kind: 'number', default: 120, unit: { scale: 1, suffix: 'ms' } });
    expect((LEAVES.get('z.z-modal') as PrefNumber).unit).toBeUndefined();
    expect(LEAVES.get('font.font-mono')).toMatchObject({ kind: 'string', default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' });
    expect(LEAVES.get('fg.fg-muted')?.kind).toBe('string');
  });

  it('names a token on its group\'s page without the group\'s prefix, and is still found by its whole name', () => {
    expect(LEAVES.get('button.button-pressed-surface')).toMatchObject({ name: 'pressed-surface', tags: ['button-pressed-surface'] });
    expect(LEAVES.get('surface.surface')?.name).toBe('surface');
  });

  it('splits a default only along the axes the token differs by', () => {
    const surface = LEAVES.get('surface.surface')!;
    expect(surface.defaultLocus).toEqual({
      $by: 'axis.mode',
      $of: { dark: resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface'], light: resolveTheme(weaselTheme, { mode: 'light' })['--wzl-surface'] },
    });
    expect(surface.default).toBe(resolveTheme(weaselTheme)['--wzl-surface']);
    expect(LEAVES.get('control.control-h')!.defaultLocus?.$by).toBe('axis.density');
    expect(LEAVES.get('gray.gray-50')!.defaultLocus).toBeUndefined();
  });

  it('reads the theme as it is from a store nothing was written to', () => {
    const store = open(SCHEMA);
    store.set('axis.mode', 'light');
    store.set('axis.density', 'compact');
    const resolved = resolveTheme(weaselTheme, { mode: 'light', density: 'compact' });
    expect(store.get('surface.surface')).toBe(resolved['--wzl-surface']);
    expect(`${store.get('control.control-h') as number}px`).toBe(resolved['--wzl-control-h']);
    expect(themePrefsPins(store)).toEqual({});
    expect(themePrefsSelection(store)).toEqual({ mode: 'light', density: 'compact' });
  });
});

describe('a store over a theme, back as a theme', () => {
  it('pins a leaf that was set, a split one by axis, and leaves the rest to the theme', () => {
    const store = open(SCHEMA);
    store.set('gray.gray-50', '#ff3366');
    store.set('surface.surface', '#fffdf8', { at: { 'axis.mode': 'light' } });
    store.set('motion.motion-fast', 90);
    const dark = resolveTheme(weaselTheme)['--wzl-surface'];
    expect(themePrefsPins(store)).toEqual({
      'gray-50': '#ff3366',
      surface: { by: 'mode', dark, light: '#fffdf8' },
      'motion-fast': '90ms',
    });
  });

  it('resolves and rebases like a theme defined with those pins', () => {
    const store = open(SCHEMA);
    store.set('axis.mode', 'light');
    store.set('accent.accent-base', '#ff3366');
    store.set('surface.surface', '#fffdf8');
    const theme = themeFromPrefs(store, weaselTheme);
    expect(theme.name).toBe('weasel-prefs');
    const byHand = defineTheme({ name: 'x', pins: { 'accent-base': { by: 'mode', light: '#ff3366' }, surface: { by: 'mode', light: '#fffdf8' } } });
    expect(resolveTheme(theme, themePrefsSelection(store))).toEqual(resolveTheme(byHand, { mode: 'light' }));
    expect(resolveTheme(theme, { mode: 'light' })['--wzl-accent']).toBe('#ff3366');
    expect(resolveTheme(theme)).toEqual(resolveTheme(weaselTheme));
  });

  it('follows the theme again once the leaf is reset', () => {
    const store = open(SCHEMA);
    store.set('accent.accent-base', '#ff3366');
    store.reset('accent.accent-base');
    expect(themePrefsPins(store)).toEqual({});
  });

  it('pins a hook, which the base theme does not declare', () => {
    const store = open(SCHEMA);
    store.set('swatch.swatch-size', 20);
    expect(resolveTheme(themeFromPrefs(store, weaselTheme))['--wzl-swatch-size' as never]).toBe('20px');
  });
});

describe('themePrefsValues', () => {
  it('reads an unset alias from the pinned theme, where the store reads it from the base', () => {
    const store = open(SCHEMA);
    store.set('accent.accent-base', '#ff3366');
    const pinned = resolveTheme(themeFromPrefs(store, weaselTheme));
    const { values } = themePrefsValues(store, weaselTheme);
    const accent = (values.accent as Record<string, unknown>).accent;
    expect(accent).toBe(pinned['--wzl-accent']);
    expect(accent).not.toBe(store.get('accent.accent'));
    expect((values.accent as Record<string, unknown>)['accent-base']).toBe('#ff3366');
    expect(store.values().accent).not.toBe(values.accent);
  });

  it('keeps the loci of a set leaf, and reads an unset one split as the pinned theme has it', () => {
    const store = open(SCHEMA);
    store.split('gray.gray-50', 'axis.density');
    const { loci } = themePrefsValues(store, weaselTheme);
    expect(loci.get('gray.gray-50')?.$by).toBe('axis.density');
    expect(loci.get('surface.surface')).toEqual(store.locus('surface.surface'));
    expect(loci.has('gray.gray-100')).toBe(false);
  });
});

describe('a theme that extends another', () => {
  it('makes leaves for its own tokens and takes a pin’s type from the token it replaces', () => {
    const acme = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff3366', 'acme-gap': { value: '3px', type: 'dimension' } } });
    const leaves = prefLeaves(themePrefsSchema(acme));
    expect(leaves.get('accent.accent-base')).toMatchObject({ kind: 'color', default: '#ff3366' });
    expect(leaves.get('acme.acme-gap')).toMatchObject({ kind: 'number', default: 3 });
  });
});

describe('themePrefsReferences', () => {
  const refer = themePrefsReferences(SCHEMA);

  it('reads a whole-value var() of a token as the leaf that edits it', () => {
    expect(refer(LEAVES.get('button.button-confirm-fg')!.default)).toEqual({ property: '--wzl-fg-on-accent', path: 'fg.fg-on-accent' });
    expect(refer(' var( --wzl-gray-50 ) ')).toEqual({ property: '--wzl-gray-50', path: 'gray.gray-50' });
  });

  it('reads a property that is no token of the theme as a reference with no leaf', () => {
    expect(refer(LEAVES.get('button.button-surface')!.default)).toEqual({ property: '--btn-glass' });
  });

  it('reads a var() among other text, one with a fallback, or anything not text, as no reference', () => {
    expect(refer('1px solid var(--wzl-border)')).toBeUndefined();
    expect(refer('var(--wzl-border, red)')).toBeUndefined();
    expect(refer('calc(var(--btn-height) * 0.1)')).toBeUndefined();
    expect(refer(12)).toBeUndefined();
  });
});
