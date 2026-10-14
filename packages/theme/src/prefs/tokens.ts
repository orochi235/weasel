// Every token of a theme as the prefs bridge reads it: what it is, and the CSS it resolves to at each selection.

import { enumerateSelections, isByAxis, selectionKey, type AxisDefs, type Selection } from '../axes.ts';
import { TOKEN_MANIFEST, type TokenManifestEntry } from '../generated/manifest.ts';
import { resolveTheme, themeAxes, themeChain } from '../resolveTheme.ts';
import type { Theme } from '../theme.ts';

const PREFIX = '--wzl-';

/** One token of a theme, named without `--wzl-`. */
export interface TokenRow {
  readonly name: string;
  readonly type: string;
  readonly group: string;
  readonly description: string;
  /** The CSS it resolves to, by `selectionKey`. */
  readonly css: Readonly<Record<string, string>>;
}

/** A theme's tokens and the axes they were resolved along. */
export interface TokenTable {
  readonly axes: AxisDefs;
  readonly rows: readonly TokenRow[];
}

const MANIFEST = new Map<string, TokenManifestEntry>(TOKEN_MANIFEST.map((entry) => [entry.name.slice(PREFIX.length), entry]));

const groupOf = (name: string): string => (name.includes('-') ? name.slice(0, name.indexOf('-')) : name);

/** The type and description each token was first declared with, root theme first. A pin's type is `unknown`. */
function declared(theme: Theme): Map<string, { type: string | undefined; description: string }> {
  const out = new Map<string, { type: string | undefined; description: string }>();
  for (const link of themeChain(theme)) {
    for (const [name, varying] of Object.entries(link.tokens)) {
      let raw: unknown = varying;
      while (isByAxis(raw)) raw = Object.entries(raw).find(([key]) => key !== 'by')?.[1];
      const token = raw as { type?: string; description?: string } | undefined;
      const had = out.get(name);
      out.set(name, {
        type: had?.type ?? (token?.type !== 'unknown' ? token?.type : undefined),
        description: had?.description || token?.description || '',
      });
    }
  }
  return out;
}

/**
 * Every token `theme` resolves, then every override hook it leaves alone, each
 * with its CSS at every selection of the theme's axes. A hook reads as its
 * fallback at all of them.
 */
export function tokenTable(theme: Theme): TokenTable {
  const axes = themeAxes(theme);
  const resolved = enumerateSelections(axes).map(
    (selection): [string, Record<string, string>] => [selectionKey(axes, selection), resolveTheme(theme, selection)],
  );
  const own = declared(theme);
  const names = new Set<string>();
  for (const [, tokens] of resolved) for (const name of Object.keys(tokens)) names.add(name.slice(PREFIX.length));

  const rows: TokenRow[] = [];
  for (const name of names) {
    const listed = MANIFEST.get(name);
    const said = own.get(name);
    const css: Record<string, string> = {};
    for (const [key, tokens] of resolved) {
      const value = tokens[PREFIX + name];
      if (value !== undefined) css[key] = value;
    }
    rows.push({
      name,
      type: said?.type ?? listed?.type ?? 'string',
      group: listed?.group ?? groupOf(name),
      description: said?.description || listed?.description || '',
      css,
    });
  }
  for (const [name, listed] of MANIFEST) {
    if (!listed.hook || names.has(name)) continue;
    const css = Object.fromEntries(resolved.map(([key]) => [key, listed.defaultValue]));
    rows.push({ name, type: listed.type, group: listed.group, description: listed.description, css });
  }
  return { axes, rows };
}

/**
 * `at(selection)` over every selection of `axes`, as a value split only by
 * the axes it differs along, the first axis outermost. `split` builds one
 * level from an axis and what each of its values holds.
 */
export function foldAxes(
  axes: AxisDefs,
  at: (selection: Selection) => unknown,
  split: (axis: string, members: Record<string, unknown>) => unknown,
): unknown {
  const names = Object.keys(axes);
  const walk = (i: number, selection: Selection): unknown => {
    if (i === names.length) return at(selection);
    const axis = names[i]!;
    const members = Object.keys(axes[axis]!.values).map((value): [string, unknown] => [value, walk(i + 1, { ...selection, [axis]: value })]);
    const first = JSON.stringify(members[0]![1]);
    return members.every(([, member]) => JSON.stringify(member) === first) ? members[0]![1] : split(axis, Object.fromEntries(members));
  };
  return walk(0, {});
}
