/**
 * A registry as a filterable tree of categories beside the entry picked. The
 * host supplies the categories and renders the detail, so the same screen
 * shows a live canvas's tools, actions and deps or an app's static catalog.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
  onSelect(pick: RegistryBrowserPick): void;
  /** The picked entry's detail, or what to show with nothing picked. */
  detail: ReactNode;
  /** Category ids open at mount. Default none. */
  defaultOpen?: Iterable<string>;
  /** Controlled filter text. Omit both to let the browser hold it. */
  filter?: string;
  onFilterChange?(next: string): void;
  /** A leading glyph for the filter field. */
  filterIcon?: ReactNode;
  className?: string;
}

const categoryKey = (id: string) => `cat:${id}`;
const groupKey = (id: string) => `group:${id}`;
const leafKey = (category: string, id: string) => `${category}/${id}`;

const countBadge = (count: number, className?: string) => (
  <Badge className={className} shape="pill" size="sm" variant="solid">{count}</Badge>
);

function treeOf(categories: readonly RegistryCategory[]) {
  const picks = new Map<string, RegistryBrowserPick>();
  const texts = new Map<string, string[]>();
  const out: TreeNode[] = [];
  const groups = new Map<string, TreeNode & { children: TreeNode[] }>();
  for (const c of categories) {
    const branch: TreeNode = {
      id: categoryKey(c.id),
      label: c.label,
      trailing: countBadge(c.entries.length),
      children: c.entries.map((e) => {
        const key = leafKey(c.id, e.id);
        picks.set(key, { category: c.id, id: e.id });
        texts.set(key, [e.label, ...(e.match ?? [])].map((t) => t.toLowerCase()));
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
  for (const group of groups.values()) group.trailing = countBadge(group.children.length);
  return { nodes: out, picks, texts };
}

/**
 * A filter field over a tree of registry categories, beside a detail pane.
 * Filtering opens every branch with a match; clearing it restores what was
 * open. Picking an entry from outside the tree opens its category.
 */
export function RegistryBrowser(props: RegistryBrowserProps): ReactElement {
  const { categories, selected, onSelect, detail, filterIcon, className } = props;
  const [ownFilter, setOwnFilter] = useState('');
  const filter = props.filter ?? ownFilter;
  const setFilter = props.onFilterChange ?? setOwnFilter;
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set([...(props.defaultOpen ?? [])].map(categoryKey)),
  );

  // Open the selection's category when the selection moves into it, and only then, so it can still be closed.
  const selectedCategory = selected ? categories.find((c) => c.id === selected.category) ?? null : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if ((selectedCategory?.id ?? null) !== openedFor) {
    setOpenedFor(selectedCategory?.id ?? null);
    if (selectedCategory) {
      const ids = [categoryKey(selectedCategory.id), ...(selectedCategory.group ? [groupKey(selectedCategory.group.id)] : [])];
      setOpenIds((cur) => (ids.every((id) => cur.has(id)) ? cur : new Set([...cur, ...ids])));
    }
  }

  const { nodes, picks, texts } = useMemo(() => treeOf(categories), [categories]);
  const q = filter.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? filterTree(nodes, (n) => texts.get(n.id)?.some((t) => t.includes(q)) ?? false) : nodes),
    [nodes, texts, q],
  );
  const selectedIds = selected ? [leafKey(selected.category, selected.id)] : [];

  const treeRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected?.category, selected?.id]);

  return (
    <div className={[s.split, className].filter(Boolean).join(' ')}>
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
            if (pick) onSelect(pick);
          }}
        />
      </div>
      <div className={s.detailPane} data-pane="detail">{detail}</div>
    </div>
  );
}
