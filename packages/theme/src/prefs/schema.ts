import { isPrefScope, prefLeaves, prefScopeSelectors, type PrefGroup, type PrefLeaf, type PrefScope, type PrefScopeSpec } from '@weasel-js/prefs';
import { selectionKey } from '../axes.ts';
import { weaselTheme, type Theme } from '../theme.ts';
import { prefOfCss, tokenLeafKind } from './leaf.ts';
import { foldAxes, tokenTable, type TokenRow } from './tokens.ts';

/** The key of the group a theme's axes are chosen in: `axis.mode` is the leaf holding the mode. */
export const THEME_PREFS_AXIS = 'axis';

/** The path of the leaf that holds `axis`'s value. */
export const themeAxisPath = (axis: string): string => `${THEME_PREFS_AXIS}.${axis}`;

/** The axis a leaf at `path` holds the value of, or `undefined` for a token's leaf. */
export const themeAxisOf = (path: string): string | undefined =>
  (path.startsWith(`${THEME_PREFS_AXIS}.`) ? path.slice(THEME_PREFS_AXIS.length + 1) : undefined);

/** The token a leaf at `path` edits, named without `--wzl-`. */
export const themeTokenOf = (path: string): string => path.slice(path.indexOf('.') + 1);

const labeled = (text: string): string => (text === '' ? text : text[0]!.toUpperCase() + text.slice(1));

// A token group named for the axes' own key takes another; no group's name holds a `-`.
const groupKey = (group: string): string => (group === THEME_PREFS_AXIS ? `${THEME_PREFS_AXIS}-tokens` : group);

/** The scope of a value that differs along `axes`, each level keyed by its axis's leaf. */
export const scopeByAxis = (axis: string, members: Record<string, unknown>): PrefScope => ({ $by: themeAxisPath(axis), $in: members });

// On its group's page a token's group prefix says nothing; its whole name stays a tag, so a filter still finds it.
const shortName = (row: TokenRow): string => (row.name.startsWith(`${row.group}-`) ? row.name.slice(row.group.length + 1) : row.name);

/**
 * A token's pref. Its scopes are the axes its CSS differs along anywhere, and
 * any its definitions ask for, each open and in the theme's axis order; a
 * token that differs along none is one plain value. Its default is the CSS
 * folded along those axes, so a store nothing was written to reads the theme.
 */
function tokenLeaf(row: TokenRow, table: ReturnType<typeof tokenTable>): PrefLeaf {
  const name = shortName(row);
  const leaf = {
    ...tokenLeafKind(row), name, description: row.description, default: undefined as unknown,
    // Auto is following the theme; a pin goes over it.
    auto: { on: true },
    ...(name === row.name ? {} : { tags: [row.name] }),
  } as PrefLeaf;
  const fallback = row.css[selectionKey(table.axes, {})] ?? Object.values(row.css)[0];
  const held = foldAxes(table.axes, (selection) => prefOfCss(leaf, row.css[selectionKey(table.axes, selection)] ?? fallback), scopeByAxis);
  leaf.default = prefOfCss(leaf, fallback);
  const differs = prefScopeSelectors(held);
  const scopes = Object.keys(table.axes)
    .filter((axis) => differs.has(themeAxisPath(axis)) || row.scope?.includes(axis))
    .map((axis): PrefScopeSpec => ({ selector: themeAxisPath(axis) }));
  if (scopes.length > 0) leaf.scopes = scopes;
  if (isPrefScope(held)) leaf.defaultScope = held;
  return leaf;
}

/**
 * `theme` as a preferences schema. Under `axis`, an `enum` for each of the
 * theme's axes, set to its default. Then a page for each token group, resettable, holding
 * a leaf for every token the theme resolves and every override hook, named
 * without its group's prefix: a
 * `color`, a `number` in the token's unit, or a `string` of CSS text for what
 * neither holds. A leaf is at `<group>.<token>`, the token named without
 * `--wzl-`, and is scoped by the axes its value differs along.
 *
 * A leaf's default is what the theme resolves the token to, already split
 * along the axes it differs by, and a token starts auto (`auto.on`), following
 * it, so a store nothing was written to reads the theme as it is. An axis is
 * always pinned. {@link themeFromPrefs} turns what was written into a theme.
 */
export function themePrefsSchema(theme: Theme = weaselTheme): PrefGroup {
  const table = tokenTable(theme);
  const axes: Record<string, PrefLeaf> = {};
  for (const [axis, def] of Object.entries(table.axes)) {
    axes[axis] = {
      kind: 'enum',
      name: labeled(axis),
      description: '',
      default: def.default,
      auto: false,
      options: Object.keys(def.values).map((value) => ({ value, label: labeled(value) })),
    };
  }
  const children: Record<string, PrefGroup> = { [THEME_PREFS_AXIS]: { name: 'Axes', children: axes } };
  for (const row of table.rows) {
    const key = groupKey(row.group);
    if (!Object.hasOwn(children, key)) children[key] = { name: labeled(row.group), resettable: true, children: {} };
    children[key].children[row.name] = tokenLeaf(row, table);
  }
  return { name: `${labeled(theme.name)} theme`, children };
}

/** What a token's CSS refers to, as {@link themePrefsReferences} reads it. */
export interface ThemePrefsReference {
  /** The custom property referred to, `--` and all. */
  readonly property: string;
  /** The path of the leaf that edits it, where it is one of the schema's tokens. */
  readonly path?: string;
}

const WHOLE_VAR = /^\s*var\(\s*(--[\w-]+)\s*\)\s*$/;

/**
 * Reads a token's CSS as a reference to another custom property where the whole of it is one `var()` with no
 * fallback, and finds the leaf of `schema` that edits that property. Anything else, a `calc()` or a shadow that
 * holds a `var()` among other text included, reads as no reference.
 */
export function themePrefsReferences(schema: PrefGroup): (css: unknown) => ThemePrefsReference | undefined {
  const paths = new Map<string, string>();
  for (const path of prefLeaves(schema).keys()) if (themeAxisOf(path) === undefined) paths.set(`--wzl-${themeTokenOf(path)}`, path);
  return (css) => {
    const property = typeof css === 'string' ? WHOLE_VAR.exec(css)?.[1] : undefined;
    if (property === undefined) return undefined;
    const path = paths.get(property);
    return path === undefined ? { property } : { property, path };
  };
}
