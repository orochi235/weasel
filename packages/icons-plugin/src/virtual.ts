import type { IconTable } from '@weasel-js/icons';

export const PREFIX = 'virtual:weasel-icons';
export const RESOLVED = '\0' + PREFIX;
/** The default module's variant: the glyphs the build names. */
export const USED = '';

/** The variant a resolved virtual id names, or `undefined` for any other id. */
export function variantOf(id: string): string | undefined {
  if (id === RESOLVED) return USED;
  return id.startsWith(RESOLVED + '/') ? id.slice(RESOLVED.length + 1) : undefined;
}

/**
 * A string literal survives minification; an identifier would be renamed. Each code unit of the name outside
 * `[A-Za-z0-9_.-]` is written `%uXXXX`, quotes and lone surrogates included, so any name sits in any quote a
 * minifier picks and reads back whole.
 */
export const moduleFor = (variant: string) =>
  `export default JSON.parse("__WEASEL_ICONS__:${variant.replace(/[^\w.-]/g, (c) => `%u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}");`;
export const MARKER = /(["'`])__WEASEL_ICONS__:([\w.%-]*)\1/g;

/** The variant name a {@link MARKER} match names. */
export const markedVariant = (m: RegExpMatchArray): string =>
  m[2]!.replace(/%u([0-9a-f]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));

/** Which glyphs a custom variant holds. Each listed field narrows; a glyph needs one of the listed tags. */
export interface VariantFilter {
  namespaces?: string[];
  groups?: string[];
  tags?: string[];
}

type Keep = (ns: string, name: string, tags: readonly string[], group: string) => boolean;

/** `tables` cut down to the glyphs `keep` admits, dropping any table left empty. */
export function subset(tables: readonly IconTable[], keep: Keep): IconTable[] {
  return tables
    .map((t) => ({
      ...t,
      icons: Object.fromEntries(Object.entries(t.icons).filter(([n, g]) => keep(t.namespace, n, g.tags, g.group))),
    }))
    .filter((t) => Object.keys(t.icons).length > 0);
}

export function admits(f: VariantFilter): Keep {
  return (ns, _name, tags, group) =>
    (!f.namespaces || f.namespaces.includes(ns)) &&
    (!f.groups || f.groups.includes(group)) &&
    (!f.tags || f.tags.some((t) => tags.includes(t)));
}
