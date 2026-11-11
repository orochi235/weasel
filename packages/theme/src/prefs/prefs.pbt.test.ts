/**
 * Property tests of a theme as a prefs schema and a store over it back as a theme, for random themes and chains
 * whose token names include `Object.prototype` members: the schema builds for any theme that resolves; a store
 * nothing was written to reads the theme and pins nothing; and writing back what a leaf reads changes nothing the
 * theme resolves.
 */
import { parseColor, rgbaToHex } from '@weasel-js/paint';
import { openPrefsSync, prefLeaves, type PrefGroup } from '@weasel-js/prefs';
import { createMemoryAdapter } from '@weasel-js/storage';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections } from '../axes';
import { chainTheme, outcome, runs, tally, timeoutFor } from '../pbt.fixture';
import { resolveTheme, themeAxes } from '../resolveTheme';
import type { Theme } from '../theme';
import { prefOfCss } from './leaf';
import { themeFromPrefs, themePrefsPins } from './pins';
import { themeAxisOf, themeAxisPath, themePrefsSchema, themeTokenOf } from './schema';

const RUNS = 120;

/** `css` as hex when it is a color paint can read, else as written. paint reads no `color-mix()` of `oklch()`. */
function asColor(css: string | undefined): string | undefined {
  try {
    return css === undefined ? css : rgbaToHex(parseColor(css));
  } catch {
    return css;
  }
}
const unreadable = (css: string | undefined) => css !== undefined && css.startsWith('color-mix(') && asColor(css) === css;

const open = (schema: PrefGroup) => openPrefsSync(schema, { storage: createMemoryAdapter(), prefix: 't.' });

/** `theme` resolved at every selection of its axes, or null when it does not resolve somewhere. */
function resolvedEverywhere(theme: Theme): Map<string, Record<string, string>> | null {
  const out = new Map<string, Record<string, string>>();
  for (const sel of enumerateSelections(themeAxes(theme))) {
    const r = outcome(() => resolveTheme(theme, sel));
    if (typeof r === 'string') return null;
    out.set(JSON.stringify(sel), r);
  }
  return out;
}

describe('themePrefsSchema and a store over it', () => {
  it('builds for any theme that resolves, and a store nothing was written to reads the theme and pins nothing', () => {
    const t = tally();
    fc.assert(fc.property(chainTheme, (theme) => {
      const base = resolvedEverywhere(theme);
      if (!base) return;
      t.count('resolves');
      const schema = themePrefsSchema(theme);
      const store = open(schema);
      expect(themePrefsPins(store)).toEqual({});
      for (const sel of enumerateSelections(themeAxes(theme))) {
        for (const [axis, v] of Object.entries(sel)) store.set(themeAxisPath(axis), v);
        const css = base.get(JSON.stringify(sel))!;
        for (const [path, leaf] of prefLeaves(schema)) {
          if (themeAxisOf(path) !== undefined) continue;
          const name = `--wzl-${themeTokenOf(path)}`;
          if (!Object.hasOwn(css, name)) continue;
          t.count('leaf');
          expect({ path, value: store.get(path) }).toEqual({ path, value: prefOfCss(leaf, css[name]) });
        }
        expect(resolveTheme(themeFromPrefs(store, theme), sel)).toEqual(css);
      }
    }), runs(RUNS));
    t.atLeast('resolves', RUNS / 3);
    t.atLeast('leaf', 100);
  }, timeoutFor(RUNS, 40));

  it('writing back what an unscoped leaf reads changes nothing the theme resolves', () => {
    const t = tally();
    fc.assert(fc.property(chainTheme, fc.infiniteStream(fc.boolean()), (theme, pickLeaf) => {
      const base = resolvedEverywhere(theme);
      if (!base) return;
      const schema = themePrefsSchema(theme);
      const store = open(schema);
      for (const [path, leaf] of prefLeaves(schema)) {
        if (themeAxisOf(path) !== undefined || leaf.scopes !== undefined || store.get(path) === undefined) continue;
        if (!pickLeaf.next().value) continue;
        t.count('written');
        store.set(path, store.get(path));
      }
      const pinned = themeFromPrefs(store, theme);
      // A hook the theme leaves to its fallback resolves once written, to that fallback; only what it resolved before
      // is compared. A color leaf holds hex, so a color is compared as the color it is, not as its text.
      for (const sel of enumerateSelections(themeAxes(theme))) {
        const before = base.get(JSON.stringify(sel))!;
        const after: Record<string, string> = resolveTheme(pinned, sel);
        const compared = Object.keys(before).filter((n) => !unreadable(before[n]));
        expect(Object.fromEntries(compared.map((n) => [n, asColor(after[n])]))).toEqual(Object.fromEntries(compared.map((n) => [n, asColor(before[n])])));
      }
    }), runs(RUNS));
    t.atLeast('written', 100);
  }, timeoutFor(RUNS, 40));
});
