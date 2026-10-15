import { isPrefLocus, prefLeaves, type PrefGroup, type PrefLeaf, type PrefLocus } from '@weasel-js/prefs';
import { selectionKey, type Selection, type Varying } from '../axes.ts';
import type { PinValue } from '../definition.ts';
import { defineTheme, type Theme } from '../theme.ts';
import { cssOfPref, prefOfCss } from './leaf.ts';
import { locusByAxis, themeAxisOf, themeTokenOf } from './schema.ts';
import { foldAxes, tokenTable } from './tokens.ts';

/** What the bridge reads of a store over a {@link themePrefsSchema}: any `PrefsStore` is one. */
export interface ThemePrefsSource {
  schema: PrefGroup;
  get(path: string): unknown;
  locus(path: string): PrefLocus | undefined;
  isSet(path: string): boolean;
}

function pinOf(leaf: PrefLeaf, held: unknown): Varying<PinValue> {
  if (!isPrefLocus(held)) return cssOfPref(leaf, held);
  const out: Record<string, unknown> = { by: themeAxisOf(held.$by) ?? held.$by };
  for (const [value, member] of Object.entries(held.$of)) out[value] = pinOf(leaf, member);
  return out as Varying<PinValue>;
}

/** The value of each axis as the store has it set: the selection to resolve or apply its theme at. */
export function themePrefsSelection(store: ThemePrefsSource): Selection {
  const out: Record<string, string> = {};
  for (const path of prefLeaves(store.schema).keys()) {
    const axis = themeAxisOf(path);
    if (axis !== undefined) out[axis] = store.get(path) as string;
  }
  return out;
}

/**
 * Every token leaf the store has a value of its own for, as `pins` for a
 * `ThemeDefinition`: a split value in theme's `{ by, … }` form, a color as
 * hex, a number in its unit, and a string as it is held. A leaf following its
 * default is no pin, so the token keeps its rule in the theme the pins go
 * over: an alias left alone still follows a primitive that was pinned.
 */
export function themePrefsPins(store: ThemePrefsSource): Record<string, Varying<PinValue>> {
  const out: Record<string, Varying<PinValue>> = {};
  for (const [path, leaf] of prefLeaves(store.schema)) {
    if (themeAxisOf(path) !== undefined || !store.isSet(path)) continue;
    out[themeTokenOf(path)] = pinOf(leaf, store.locus(path) ?? store.get(path));
  }
  return out;
}

/** `base` with the store's pins over it. `name` defaults to `base`'s with `-prefs` after it. */
export function themeFromPrefs(store: ThemePrefsSource, base: Theme, name = `${base.name}-prefs`): Theme {
  return defineTheme({ name, extends: base, pins: themePrefsPins(store) });
}

/** What {@link themePrefsValues} reads beside the pins. */
export interface ThemePrefsValuesSource extends ThemePrefsSource {
  values(): Record<string, unknown>;
  loci(): ReadonlyMap<string, PrefLocus>;
}

/**
 * The store's values and loci as a form shows them, with every leaf that
 * follows its default read from the pinned theme, where the store reads it
 * from `base`. They differ for an alias of a token that was pinned: `accent`
 * after `accent-base` is set. Shaped as `store.values()` and `store.loci()`.
 */
export function themePrefsValues(
  store: ThemePrefsValuesSource,
  base: Theme,
): { values: Record<string, unknown>; loci: ReadonlyMap<string, PrefLocus> } {
  const { axes, rows } = tokenTable(themeFromPrefs(store, base));
  const css = new Map(rows.map((row) => [row.name, row.css]));
  const now = selectionKey(axes, themePrefsSelection(store));
  const values: Record<string, unknown> = { ...store.values() };
  const loci = new Map(store.loci());
  const copied = new Set<string>();
  for (const [path, leaf] of prefLeaves(store.schema)) {
    if (themeAxisOf(path) !== undefined || store.isSet(path)) continue;
    const resolved = css.get(themeTokenOf(path));
    if (!resolved || Object.values(resolved).some((text) => prefOfCss(leaf, text) === undefined)) continue;
    const held = foldAxes(axes, (selection) => prefOfCss(leaf, resolved[selectionKey(axes, selection)]), locusByAxis);
    if (isPrefLocus(held)) loci.set(path, held);
    else loci.delete(path);
    const group = path.slice(0, path.indexOf('.'));
    if (!copied.has(group)) {
      copied.add(group);
      values[group] = { ...(values[group] as Record<string, unknown>) };
    }
    (values[group] as Record<string, unknown>)[themeTokenOf(path)] = prefOfCss(leaf, resolved[now]);
  }
  return { values, loci };
}
