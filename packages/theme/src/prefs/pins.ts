import { isPrefScope, PREF_ELSE, prefLeaves, type PrefEnum, type PrefGroup, type PrefLeaf, type PrefScope } from '@weasel-js/prefs';
import { selectionKey, type Selection, type Varying } from '../axes.ts';
import type { PinValue } from '../definition.ts';
import { defineTheme, type Theme } from '../theme.ts';
import { cssOfPref, prefOfCss } from './leaf.ts';
import { scopeByAxis, themeAxisOf, themeTokenOf } from './schema.ts';
import { foldAxes, tokenTable } from './tokens.ts';

/** What the bridge reads of a store over a {@link themePrefsSchema}: any `PrefsStore` is one. */
export interface ThemePrefsSource {
  schema: PrefGroup;
  get(path: string): unknown;
  scope(path: string): PrefScope | undefined;
  isSet(path: string): boolean;
}

/** The options of the selector at `path`: an axis's enum. */
type OptionsOf = (path: string) => readonly string[];

function optionsIn(schema: PrefGroup): OptionsOf {
  const leaves = prefLeaves(schema);
  return (path) => {
    const leaf = leaves.get(path);
    return leaf?.kind === 'enum' ? (leaf as PrefEnum).options.map((option) => option.value) : [];
  };
}

/** `held` in theme's `{ by, … }` form, each option without a value of its own given the scope's shared one. */
function pinOf(leaf: PrefLeaf, held: unknown, options: OptionsOf): Varying<PinValue> {
  if (!isPrefScope(held)) return cssOfPref(leaf, held);
  const out: Record<string, unknown> = { by: themeAxisOf(held.$by) ?? held.$by };
  const shared = Object.hasOwn(held, PREF_ELSE);
  for (const value of shared ? options(held.$by) : []) out[value] = pinOf(leaf, held[PREF_ELSE], options);
  for (const [value, member] of Object.entries(held.$in)) out[value] = pinOf(leaf, member, options);
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
  const options = optionsIn(store.schema);
  for (const [path, leaf] of prefLeaves(store.schema)) {
    if (themeAxisOf(path) !== undefined || !store.isSet(path)) continue;
    out[themeTokenOf(path)] = pinOf(leaf, store.scope(path) ?? store.get(path), options);
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
  scopes(): ReadonlyMap<string, PrefScope>;
}

/**
 * The store's values and scopes as a form shows them, with every leaf that
 * follows its default read from the pinned theme, where the store reads it
 * from `base`. They differ for an alias of a token that was pinned: `accent`
 * after `accent-base` is set. Shaped as `store.values()` and `store.scopes()`.
 */
export function themePrefsValues(
  store: ThemePrefsValuesSource,
  base: Theme,
): { values: Record<string, unknown>; scopes: ReadonlyMap<string, PrefScope> } {
  const { axes, rows } = tokenTable(themeFromPrefs(store, base));
  const css = new Map(rows.map((row) => [row.name, row.css]));
  const now = selectionKey(axes, themePrefsSelection(store));
  const values: Record<string, unknown> = { ...store.values() };
  const scopes = new Map(store.scopes());
  const copied = new Set<string>();
  for (const [path, leaf] of prefLeaves(store.schema)) {
    if (themeAxisOf(path) !== undefined || store.isSet(path)) continue;
    const resolved = css.get(themeTokenOf(path));
    if (!resolved || Object.values(resolved).some((text) => prefOfCss(leaf, text) === undefined)) continue;
    const held = foldAxes(axes, (selection) => prefOfCss(leaf, resolved[selectionKey(axes, selection)]), scopeByAxis);
    if (isPrefScope(held)) scopes.set(path, held);
    else scopes.delete(path);
    const value = prefOfCss(leaf, resolved[now]);
    const dot = path.indexOf('.');
    if (dot < 0) {
      values[path] = value;
      continue;
    }
    const group = path.slice(0, dot);
    if (!copied.has(group)) {
      copied.add(group);
      values[group] = { ...(values[group] as Record<string, unknown>) };
    }
    (values[group] as Record<string, unknown>)[themeTokenOf(path)] = value;
  }
  return { values, scopes };
}
