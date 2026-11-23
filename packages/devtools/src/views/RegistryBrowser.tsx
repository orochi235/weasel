/**
 * A registry as a filterable tree of categories beside the entry picked. The
 * host supplies the categories and renders the detail, so the same screen
 * shows a live canvas's tools, actions and deps or an app's static catalog.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { matchQuery, type Findable } from '@weasel-js/registry';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Input } from '@weasel-js/ui/components/Input';
import { Tree, filterTree, treeBranchIds, type TreeNode } from '@weasel-js/ui/components/Tree';
import s from './RegistryBrowser.module.css';

/** One entry of a {@link RegistryCategory}. */
export interface RegistryBrowserEntry {
  /** Unique within its category. */
  id: string;
  label: string;
  /** Further text the filter matches, besides `label`. */
  match?: readonly string[];
  /** Shown at the end of the entry's row: a count, a scope, a state. */
  trailing?: ReactNode;
}

/** A branch of the {@link RegistryBrowser} tree. Categories sharing a `group.id` nest under one parent branch. */
export interface RegistryCategory {
  id: string;
  label: string;
  group?: { id: string; label: string };
  entries: readonly RegistryBrowserEntry[];
}

/** An entry, by its category and its id there. */
export interface RegistryBrowserPick {
  category: string;
  id: string;
}

/** Props for {@link RegistryBrowser}. */
export interface RegistryBrowserProps {
  /** In display order: the browser sorts nothing. */
  categories: readonly RegistryCategory[];
  selected: RegistryBrowserPick | null;
  onSelectionChange(pick: RegistryBrowserPick): void;
  /** The picked entry's detail, or what to show with nothing picked. */
  detail: ReactNode;
  /** Category ids open at mount. Default none. */
  defaultOpen?: Iterable<string>;
  /** Controlled filter text. Omit it to let the browser hold the text; `onFilterChange` still hears each edit. */
  filter?: string;
  onFilterChange?(next: string): void;
  /** A leading glyph for the filter field. */
  filterIcon?: ReactNode;
  className?: string;
}

const categoryKey = (id: string) => `cat:${id}`;
const groupKey = (id: string) => `group:${id}`;
const leafKey = (category: string, id: string) => `leaf:${JSON.stringify([category, id])}`;

/** The branches to open so a category shows: its own and its group's. */
const openKeys = (c: Pick<RegistryCategory, 'id'> & { group?: RegistryCategory['group'] }): string[] =>
  [categoryKey(c.id), ...(c.group ? [groupKey(c.group.id)] : [])];

const countBadge = (count: number, className?: string) => (
  <Badge className={className} shape="pill" size="sm" variant="solid">{count}</Badge>
);

function treeOf(categories: readonly RegistryCategory[]) {
  const picks = new Map<string, RegistryBrowserPick>();
  const texts = new Map<string, Findable>();
  const out: TreeNode[] = [];
  const groups = new Map<string, TreeNode & { children: TreeNode[] }>();
  for (const c of categories) {
    const branch: TreeNode = {
      id: categoryKey(c.id),
      label: c.label,
      children: c.entries.map((e) => {
        const key = leafKey(c.id, e.id);
        picks.set(key, { category: c.id, id: e.id });
        texts.set(key, { text: [e.label, ...(e.match ?? [])] });
        return { id: key, label: e.label, textValue: e.label, trailing: e.trailing };
      }),
    };
    if (!c.group) {
      out.push(branch);
      continue;
    }
    let group = groups.get(c.group.id);
    if (!group) {
      group = { id: groupKey(c.group.id), label: c.group.label, children: [] };
      groups.set(c.group.id, group);
      out.push(group);
    }
    group.children.push(branch);
  }
  return { nodes: out, picks, texts };
}

const leaves = (n: TreeNode): number => (n.children ? n.children.reduce((sum, c) => sum + leaves(c), 0) : 1);

/** Badges each branch with the entries it shows, so a filtered category or group counts what the filter left. */
const counted = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.map((n) => (n.children ? { ...n, trailing: countBadge(leaves(n)), children: counted(n.children) } : n));

/**
 * A filter field over a tree of registry categories, beside a detail pane.
 * Filtering opens every branch with a match; clearing it restores what was
 * open. Picking an entry from outside the tree opens its category.
 */
export function RegistryBrowser(props: RegistryBrowserProps): ReactElement {
  const { categories, selected, onSelectionChange, detail, filterIcon, className } = props;
  const [ownFilter, setOwnFilter] = useState('');
  const filter = props.filter ?? ownFilter;
  const controlled = props.filter !== undefined;
  const { onFilterChange } = props;
  const setFilter = (next: string): void => {
    if (!controlled) setOwnFilter(next);
    onFilterChange?.(next);
  };
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set([...(props.defaultOpen ?? [])].flatMap((id) => openKeys(categories.find((c) => c.id === id) ?? { id }))),
  );

  // Open the selection's category when the selection moves into it, and only then, so it can still be closed.
  const selectedCategory = selected ? categories.find((c) => c.id === selected.category) ?? null : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if ((selectedCategory?.id ?? null) !== openedFor) {
    setOpenedFor(selectedCategory?.id ?? null);
    if (selectedCategory) {
      const ids = openKeys(selectedCategory);
      setOpenIds((cur) => (ids.every((id) => cur.has(id)) ? cur : new Set([...cur, ...ids])));
    }
  }

  const { nodes, picks, texts } = useMemo(() => treeOf(categories), [categories]);
  const q = filter.trim();
  const shown = useMemo(
    () => counted(q ? filterTree(nodes, (n) => { const t = texts.get(n.id); return t !== undefined && matchQuery(q, t) !== null; }) : nodes),
    [nodes, texts, q],
  );
  const selectedIds = selected ? [leafKey(selected.category, selected.id)] : [];

  const treeRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected?.category, selected?.id]);

  return (
    <div className={[s.browser, className].filter(Boolean).join(' ')}>
      <div className={s.split}>
        <div className={s.listPane} data-pane="list">
          <Input
            aria-label="Filter registry"
            placeholder="Filter…"
            leadingAdornment={filterIcon}
            value={filter}
            onChange={setFilter}
          />
          <Tree
            ref={treeRef}
            aria-label="Registry"
            nodes={shown}
            empty="No matches"
            expandedIds={q ? treeBranchIds(shown) : openIds}
            onExpandedChange={q ? undefined : setOpenIds}
            selectionMode="single"
            selectedIds={selectedIds}
            onAction={(id) => {
              const pick = picks.get(id);
              if (pick) onSelectionChange(pick);
            }}
          />
        </div>
        <div className={s.detailPane} data-pane="detail">{detail}</div>
      </div>
    </div>
  );
}
