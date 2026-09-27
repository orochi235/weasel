import { indexEntries } from '../../story/indexPages';
import { libraryOf } from '../../story/library';
import type { IndexEntry } from '../../story/types';
import { foldGalleries, type TreeNode } from './buildTree';

type Folder = Extract<TreeNode, { kind: 'folder' }>;

/** One component — a story title — with the stories declared under it. */
export interface ComponentRow {
  /** The full story title, unique per component and used as the row key. */
  path: string;
  /** The title's last segment: the component's own name. */
  label: string;
  /** Which library it ships in. */
  library: string;
  /** The component's index page; absent when a filter kept the row only for some of its stories. */
  index?: IndexEntry;
  entries: IndexEntry[];
}

/** Every component in the index as one flat, alphabetical list. Components
 *  sharing a name are kept apart by their library, then by their full title. */
export function buildComponents(index: readonly IndexEntry[]): ComponentRow[] {
  const byTitle = new Map<string, ComponentRow>();
  const pages = new Map(indexEntries(index).map((page) => [page.title, page]));
  for (const entry of index) {
    let row = byTitle.get(entry.title);
    if (!row) {
      const segments = entry.title.split('/');
      row = {
        path: entry.title,
        label: segments[segments.length - 1],
        library: libraryOf(entry),
        index: pages.get(entry.title),
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
 * `ui/Cursors/Gallery` and `ui/Icons/Gallery` are two different
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
 *  ignoring case. A matching component keeps its index page and all its
 *  stories; a component matching only through one story keeps just the
 *  stories that matched. */
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
    if (entries.length > 0) out.push({ path: row.path, label: row.label, library: row.library, entries });
  }
  return out;
}

/**
 * The component list as tree nodes, so the sidebar renders and navigates both
 * views with one code path. A slash in a label is a directory: `Icons/Gallery`
 * is a `Gallery` folder inside an `Icons` folder, which it shares with any
 * other row of its library widened to the same prefix. Every component is a
 * folder carrying its index page and holding its stories. A folder a gallery's label opened, holding only that
 * gallery, is folded into it.
 */
export function componentNodes(rows: readonly ComponentRow[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folders = new Map<string, Folder>();
  for (const row of rows) {
    const labels = row.label.split('/');
    const title = row.path.split('/');
    let siblings = root;
    let tag: string | undefined = row.library;
    for (let i = 0; i < labels.length - 1; i++) {
      const path = title.slice(0, title.length - labels.length + i + 1).join('/');
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: 'folder', label: labels[i], path, tag, children: [] };
        folders.set(path, folder);
        siblings.push(folder);
      }
      siblings = folder.children;
      tag = undefined;
    }
    siblings.push({
      kind: 'folder',
      label: labels[labels.length - 1],
      path: row.path,
      tag,
      ...(row.index ? { index: row.index } : {}),
      children: row.entries.map((entry) => ({ kind: 'story', entry }) as const),
    });
  }
  return foldGalleries(root);
}

/** Every library present in `index`, alphabetically. */
export function librariesIn(index: readonly IndexEntry[]): string[] {
  return [...new Set(index.map(libraryOf))].sort((a, b) => a.localeCompare(b));
}
