import { checkPrefSplits, openPrefsSync, prefLeaves, prefScopeSelectors, type PrefGroup, type PrefNumber } from '@weasel-js/prefs';
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

  it('holds a leaf for every token and hook, each scoped by the axes its value differs along', () => {
    const tokens = new Set([...LEAVES.keys()].map((path) => `--wzl-${path.slice(path.indexOf('.') + 1)}`));
    for (const name of Object.keys(resolveTheme(weaselTheme))) expect(tokens.has(name), name).toBe(true);
    expect(LEAVES.has('status.danger')).toBe(true);
    expect(LEAVES.get('swatch.swatch-size')).toMatchObject({ kind: 'number', default: 28 });
    for (const [path, leaf] of LEAVES) {
      if (path.startsWith('axis.')) continue;
      const differs = [...prefScopeSelectors(leaf.defaultScope)];
      const axes = ['axis.mode', 'axis.density'].filter((axis) => differs.includes(axis));
      expect(leaf.scopes, path).toEqual(axes.length ? axes.map((selector) => ({ selector })) : undefined);
    }
    expect(LEAVES.get('surface.surface')!.scopes).toEqual([{ selector: 'axis.mode' }]);
    expect(LEAVES.get('control.control-h')!.scopes).toEqual([{ selector: 'axis.density' }]);
    expect(LEAVES.get('font.font-mono')!.scopes).toBeUndefined();
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
    expect(surface.defaultScope).toEqual({
      $by: 'axis.mode',
      $in: { dark: resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface'], light: resolveTheme(weaselTheme, { mode: 'light' })['--wzl-surface'] },
    });
    expect(surface.default).toBe(resolveTheme(weaselTheme)['--wzl-surface']);
    expect(LEAVES.get('control.control-h')!.defaultScope?.$by).toBe('axis.density');
    expect(LEAVES.get('gray.gray-50')!.defaultScope).toBeUndefined();
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

describe('values a store kept when every token was split by every axis', () => {
  const kept = (records: Record<string, unknown>) =>
    openPrefsSync(SCHEMA, { storage: createMemoryAdapter(new Map(Object.entries(records).map(([path, value]) => [`t.${path}`, { $at: 0, value }]))), prefix: 't.' });

  it('reads a value split along an axis the token still scopes as before', () => {
    const store = kept({ 'surface.surface': { $by: 'axis.mode', $of: { dark: '#111111', light: '#eeeeee' } } });
    expect(store.get('surface.surface')).toBe('#111111');
    expect(store.get('surface.surface', { at: { 'axis.mode': 'light' } })).toBe('#eeeeee');
    expect(themePrefsPins(store)).toEqual({ surface: { by: 'mode', dark: '#111111', light: '#eeeeee' } });
  });

  it('reads a plain value as the shared one, and keeps it as that on the first write to one mode', () => {
    const store = kept({ 'surface.surface': '#222222' });
    expect(store.get('surface.surface', { at: { 'axis.mode': 'light' } })).toBe('#222222');
    store.set('surface.surface', '#fffdf8', { at: { 'axis.mode': 'light' } });
    expect(store.get('surface.surface')).toBe('#222222');
    expect(store.get('surface.surface', { at: { 'axis.mode': 'light' } })).toBe('#fffdf8');
    expect(themePrefsPins(store)).toEqual({ surface: { by: 'mode', dark: '#222222', light: '#fffdf8' } });
    expect(resolveTheme(themeFromPrefs(store, weaselTheme), { mode: 'dark' })['--wzl-surface' as never]).toBe('#222222');
  });

  it('reads a value split along an axis the token no longer scopes as before, and the first write flattens it to what reads now', () => {
    const store = kept({ 'font.font-mono': { $by: 'axis.mode', $of: { dark: 'Menlo', light: 'Monaco' } } });
    expect(store.get('font.font-mono')).toBe('Menlo');
    expect(store.get('font.font-mono', { at: { 'axis.mode': 'light' } })).toBe('Monaco');
    store.set('font.font-mono', 'Iosevka');
    expect(store.get('font.font-mono', { at: { 'axis.mode': 'light' } })).toBe('Iosevka');
    const control = kept({ 'control.control-h': { $by: 'axis.mode', $of: { dark: { $by: 'axis.density', $of: { compact: 20, comfortable: 24 } }, light: 30 } } });
    expect(control.get('control.control-h', { at: { 'axis.density': 'compact' } })).toBe(20);
    control.set('control.control-h', 26, { at: { 'axis.density': 'roomy' } });
    expect(control.get('control.control-h')).toBe(24);
    expect(control.get('control.control-h', { at: { 'axis.density': 'compact' } })).toBe(24);
    expect(control.get('control.control-h', { at: { 'axis.density': 'roomy' } })).toBe(26);
  });
});

describe('a token that asks to be scoped by an axis', () => {
  it('is scoped by it even where its value does not differ along it', () => {
    const theme = defineTheme({ name: 'scoped', pins: { 'gray-50': { value: '#f5f5f6', scope: ['mode'] } } });
    expect(prefLeaves(themePrefsSchema(theme)).get('gray.gray-50')!.scopes).toEqual([{ selector: 'axis.mode' }]);
  });

  it('is scoped by it when the ask sits on any branch of a split definition', () => {
    const theme = defineTheme({
      name: 'scoped-branch',
      extends: weaselTheme,
      pins: { 'gray-50': { by: 'density', compact: '#000000', comfortable: '#000000', roomy: { value: '#000000', scope: ['mode'] } } },
    });
    expect(prefLeaves(themePrefsSchema(theme)).get('gray.gray-50')!.scopes).toEqual([{ selector: 'axis.mode' }]);
  });
});

describe('a token the manifest does not list', () => {
  it('is grouped the way the manifest groups its siblings', () => {
    const theme = defineTheme({ name: 'extra', extends: weaselTheme, pins: { 'danger-extra': '#ff0000' } });
    expect(prefLeaves(themePrefsSchema(theme)).has('status.danger-extra')).toBe(true);
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

  it('keeps the scopes of a set leaf, and reads an unset one split as the pinned theme has it', () => {
    const store = open(SCHEMA);
    store.set('surface.surface', '#fffdf8', { at: { 'axis.mode': 'light' } });
    const { scopes } = themePrefsValues(store, weaselTheme);
    expect(scopes.get('surface.surface')?.$in.light).toBe('#fffdf8');
    expect(scopes.get('surface.surface')).toEqual(store.scope('surface.surface'));
    expect(scopes.has('gray.gray-100')).toBe(false);
  });
});

describe('themePrefsValues over a token leaf outside any group', () => {
  it('writes its value at its own key', () => {
    const schema: PrefGroup = {
      name: 'Loose',
      children: { axis: SCHEMA.children.axis!, 'font-mono': LEAVES.get('font.font-mono')! },
    };
    const { values } = themePrefsValues(open(schema), weaselTheme);
    expect(values['font-mono']).toBe(resolveTheme(weaselTheme)['--wzl-font-mono']);
    expect(Object.keys(values)).not.toContain('font-mon');
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
