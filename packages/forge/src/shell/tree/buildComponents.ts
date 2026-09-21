import type { IndexEntry } from '../../story/types';
import type { TreeNode } from './buildTree';

/** One component — a story title — with the stories declared under it. */
export interface ComponentRow {
  /** The full story title, unique per component and used as the row key. */
  path: string;
  /** The title's last segment: the component's own name. */
  label: string;
  /** Which library it ships in. */
  library: string;
  entries: IndexEntry[];
}

/**
 * Which library a story file belongs to, by the package it lives in rather
 * than by its title's first segment. The title prefix is authored per story
 * and disagrees with itself — `packages/ui` alone declares both `Primitives/`
 * and `weasel-ui/` — so the path is the answer that cannot drift.
 */
const LIBRARIES: readonly (readonly [marker: string, label: string])[] = [
  ['/packages/ui/', 'weasel-ui'],
  ['/packages/labkit/', 'labkit'],
  ['/packages/forge/', 'forge'],
  ['/apps/draw/', 'draw'],
  ['/apps/forge/', 'forge'],
];

/** `entry`'s library, falling back to its title's first segment for a file
 *  under none of the known packages. */
export function libraryOf(entry: IndexEntry): string {
  const file = entry.file.replaceAll('\\', '/');
  for (const [marker, label] of LIBRARIES) {
    if (file.includes(marker)) return label;
  }
  return entry.title.split('/')[0];
}

/** Every component in the index as one flat, alphabetical list. Components
 *  sharing a name are kept apart by their library, then by their full title. */
export function buildComponents(index: readonly IndexEntry[]): ComponentRow[] {
  const byTitle = new Map<string, ComponentRow>();
  for (const entry of index) {
    let row = byTitle.get(entry.title);
    if (!row) {
      const segments = entry.title.split('/');
      row = {
        path: entry.title,
        label: segments[segments.length - 1],
        library: libraryOf(entry),
        entries: [],
      };
      byTitle.set(entry.title, row);
    }
    row.entries.push(entry);
  }
  const rows = [...byTitle.values()];
  disambiguate(rows);
  return rows.sort(
    (a, b) =>
      a.label.localeCompare(b.label)
      || a.library.localeCompare(b.library)
      || a.path.localeCompare(b.path),
  );
}

/**
 * Widen each label leftward until it tells its row apart from the others in
 * its library.
 * `weasel-ui/Cursors/Gallery` and `weasel-ui/Icons/Gallery` are two different
 * components whose last segments agree, and a flat list that prints both as
 * `Gallery` is unusable — the grouping that used to separate them is the very
 * thing this view removes.
 */
function disambiguate(rows: readonly ComponentRow[]): void {
  // Rows in different libraries are already told apart by their tag.
  const byLabel = new Map<string, ComponentRow[]>();
  for (const row of rows) {
    const key = `${row.library}\0${row.label}`;
    const group = byLabel.get(key);
    if (group) group.push(row);
    else byLabel.set(key, [row]);
  }
  for (const group of byLabel.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      const segments = row.path.split('/');
      // One more segment at a time, stopping at the full title.
      for (let take = 2; take <= segments.length; take++) {
        row.label = segments.slice(-take).join('/');
        if (group.every((other) => other === row || !other.path.endsWith(`/${row.label}`))) break;
      }
    }
  }
}

/** The components whose name, library or story names contain `query`,
 *  ignoring case. A matching component keeps all its stories; a component
 *  matching only through one story keeps just the stories that matched. */
export function filterComponents(rows: readonly ComponentRow[], query: string): ComponentRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  const out: ComponentRow[] = [];
  for (const row of rows) {
    if (`${row.path}/${row.library}`.toLowerCase().includes(needle)) {
      out.push(row);
      continue;
    }
    const entries = row.entries.filter((entry) => entry.name.toLowerCase().includes(needle));
    if (entries.length > 0) out.push({ ...row, entries });
  }
  return out;
}

/**
 * The flat component list as tree nodes, so the sidebar renders and navigates
 * both views with one code path. A component with a single story becomes that
 * story's row directly — an expander onto one child is a click for nothing.
 */
export function componentNodes(rows: readonly ComponentRow[]): TreeNode[] {
  return rows.map((row): TreeNode =>
    row.entries.length === 1
      ? { kind: 'story', entry: row.entries[0], tag: row.library, label: row.label }
      : {
          kind: 'folder',
          label: row.label,
          path: row.path,
          tag: row.library,
          children: row.entries.map((entry) => ({ kind: 'story', entry })),
        },
  );
}

/** Every library present in `index`, alphabetically. */
export function librariesIn(index: readonly IndexEntry[]): string[] {
  return [...new Set(index.map(libraryOf))].sort((a, b) => a.localeCompare(b));
}
