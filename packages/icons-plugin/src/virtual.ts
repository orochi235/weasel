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

/** A string literal survives minification; an identifier would be renamed. */
export const moduleFor = (variant: string) => `export default JSON.parse("__WEASEL_ICONS__:${variant}");`;
export const MARKER = /(["'`])__WEASEL_ICONS__:([^"'`]*)\1/g;

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
