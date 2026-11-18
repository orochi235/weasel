/** The attributes pane's form: its rows beside the node's attributes, which of them are marked changed or mixed. */
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { AttributeAggregate, AttributeSchema } from '@weasel-js/prefs/edit';

/** Form paths for the rows that are not attributes: the key, the kind, and the kind's own panel. */
export const KEY = '$key';
export const PATH = '$path';
export const KIND = '$kind';
export const OWN = '$own';
export const AUTO = '$auto';
/** The panel for a list's or a map's entry, which draws the fields of the leaf in `item`. */
export const ENTRY = '$entry';
export const ENTRY_IS = `${ENTRY}.$kind`;
/** The attribute panels, each drawing the node's own fields under its path. */
const PANELS = [OWN, AUTO];
/** Kinds drawn by the pane's own renderers. */
export const KEY_KIND = 'schema-key';
export const PATH_KIND = 'schema-path';
export const KIND_KIND = 'schema-kind';
export const NAME_KIND = 'schema-name';
export const ENTRY_KIND = 'schema-entry-kind';
export const AUTO_VALUE_KIND = 'schema-auto-value';

/** The attribute a form path edits: the path itself, or its last part under a panel. */
export const attrOf = (p: string): string => {
  const panel = PANELS.find((k) => p.startsWith(`${k}.`));
  return panel === undefined ? p : p.slice(panel.length + 1);
};

/** What the form draws beyond the attributes themselves. */
export interface FormShows {
  /** The key and the path it is stored under. */
  keyed: boolean;
  /** The Kind picker. */
  leaf: boolean;
  /** The Entry panel, for a list's or a map's entry. */
  entry: boolean;
  /** The kind every node is, or `null` when they differ and `undefined` when any is not a leaf: names the own panel. */
  kind: string | null | undefined;
}

/** The form's rows for attributes `schema`: the name and what it says first, then the key, the kind and the panels. */
export function formRowsFor(schema: AttributeSchema, shows: FormShows): Record<string, PrefLeaf | PrefGroup> {
  const { shared, own, auto, entry } = schema;
  return {
    // First, the name and what it says, which a node's glyph stands beside; the key follows the name from under them.
    ...(shared.name ? { name: { ...shared.name, kind: NAME_KIND } as PrefLeaf } : {}),
    ...(shared.description ? { description: shared.description } : {}),
    ...(shows.keyed ? { [KEY]: { kind: KEY_KIND, name: 'Key', description: 'The name its value is stored under.', default: '' } as PrefLeaf } : {}),
    ...(shows.keyed ? { [PATH]: { kind: PATH_KIND, name: 'Path', description: 'Where its value is stored: its key, under the key of each group around it.', default: '' } as PrefLeaf } : {}),
    ...(shows.leaf ? { [KIND]: { kind: KIND_KIND, name: 'Kind', description: 'The type of value it holds, which decides the control that edits it.', default: '' } as PrefLeaf } : {}),
    ...Object.fromEntries(Object.entries(shared).filter(([k]) => k !== 'name' && k !== 'description')),
    ...(Object.keys(own).length > 0 ? { [OWN]: { name: shows.kind === undefined ? 'group' : shows.kind ?? 'Common', children: own } } : {}),
    ...(shows.entry && Object.keys(entry).length > 0 ? {
      [ENTRY]: {
        name: 'Entry',
        children: {
          $kind: { kind: ENTRY_KIND, name: 'Kind', description: 'What each entry is: a plain kind one control edits, or a type declared in code.', default: '' } as PrefLeaf,
          ...entry,
        },
      },
    } : {}),
    ...(Object.keys(auto).length > 0 ? {
      [AUTO]: { name: 'Auto', children: { ...auto, ...(auto.value ? { value: { ...auto.value, kind: AUTO_VALUE_KIND } } : {}) } },
    } : {}),
  };
}

/** The rows of the attributes in `changed` (by name, `$key` for the key): an attribute's row sits at its own name, or under the panel that holds it. */
export function markedRowsFor(changed: ReadonlySet<string>, schema: AttributeSchema): Set<string> {
  const { shared, own, auto } = schema;
  return new Set([
    ...[...changed].flatMap((attr) => [
      ...(Object.hasOwn(shared, attr) || attr === KEY ? [attr] : []),
      ...(attr === 'kind' ? [KIND] : []),
      ...(Object.hasOwn(own, attr) ? [`${OWN}.${attr}`] : []),
      // The panel's rows all live in `auto`, so a change to it marks each.
      ...(attr === 'auto' ? Object.keys(auto).map((row) => `${AUTO}.${row}`) : []),
      // What an entry is shows on its picker; any other attribute of it, on that attribute's row.
      ...(attr === 'item' || attr === 'item.kind' || attr === 'item.type' ? [ENTRY_IS] : attr.startsWith('item.') ? [`${ENTRY}.${attr.slice(5)}`] : []),
    ]),
  ]);
}

/** The rows whose values disagree among the nodes `agg` aggregates. */
export const mixedRowsFor = (agg: AttributeAggregate | null): Set<string> =>
  new Set([...[...(agg?.mixed ?? [])].flatMap((k) => [k, `${OWN}.${k}`]), ...[...(agg?.auto.mixed ?? [])].map((k) => `${AUTO}.${k}`)]);
