import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Input, SearchIcon, Tree, filterTree, treeBranchIds, type TreeNode } from '@weasel-js/ui';
import s from './RegistryInspector.module.css';
import type { TreeCategoryNode, TreeEntry } from './registryData';

interface Props {
  nodes: readonly TreeCategoryNode[];
  selected: TreeEntry | null;
  onSelect(entry: TreeEntry): void;
  /** Optional controlled-filter pair. When omitted, the tree manages
   *  filter state internally (the prior behavior). When provided, the
   *  parent owns the state so it can react to filter changes — e.g.
   *  clearing the detail pane when the selection falls out of view. */
  filter?: string;
  onFilterChange?(next: string): void;
  /** Per-leaf badge count. Return `undefined` to render no badge.
   *  Inspector uses this to show e.g. "gestures → drag (9)" — the
   *  number of tools that bind the channel. */
  getCount?(entry: TreeEntry): number | undefined;
}

export function RegistryTree({ nodes, selected, onSelect, filter: filterProp, onFilterChange, getCount }: Props) {
  const [filterInternal, setFilterInternal] = useState('');
  const filter = filterProp ?? filterInternal;
  const setFilter = onFilterChange ?? setFilterInternal;
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  // When `selected` changes (e.g. an EntryLink in the detail panel navigates
  // to a different entry), open the containing category so the leaf renders.
  const selectedCategory = useMemo(() => {
    if (!selected) return null;
    return nodes.find((n) => n.entries.some((e) => sameEntry(e, selected))) ?? null;
  }, [nodes, selected]);

  useEffect(() => {
    if (!selectedCategory) return;
    const idsToOpen: string[] = [categoryKey(selectedCategory)];
    if (selectedCategory.group) idsToOpen.push(groupKey(selectedCategory.group.id));
    setOpenIds((cur) => {
      if (idsToOpen.every((id) => cur.has(id))) return cur;
      const next = new Set(cur);
      for (const id of idsToOpen) next.add(id);
      return next;
    });
  }, [selectedCategory]);

  const { treeNodes, entriesByKey } = useMemo(() => {
    const byKey = new Map<string, TreeEntry>();
    const out: TreeNode[] = [];
    const groups = new Map<string, TreeNode & { children: TreeNode[] }>();
    for (const n of nodes) {
      const category: TreeNode = {
        id: categoryKey(n),
        label: n.label,
        trailing: countBadge(n.entries.length),
        children: n.entries.map((e) => {
          const key = leafKey(n, e);
          byKey.set(key, e);
          const count = getCount?.(e);
          return {
            id: key,
            label: e.label,
            textValue: e.label,
            trailing: count === undefined ? undefined : countBadge(count, s.leafBadge),
          };
        }),
      };
      if (!n.group) {
        out.push(category);
        continue;
      }
      let group = groups.get(n.group.id);
      if (!group) {
        group = { id: groupKey(n.group.id), label: n.group.label, children: [] };
        groups.set(n.group.id, group);
        out.push(group);
      }
      group.children.push(category);
    }
    for (const group of groups.values()) group.trailing = countBadge(group.children.length);
    return { treeNodes: out, entriesByKey: byKey };
  }, [nodes, getCount]);

  const lower = filter.trim().toLowerCase();
  const filteredNodes = useMemo(() => {
    if (!lower) return treeNodes;
    return filterTree(treeNodes, (node) => {
      const e = entriesByKey.get(node.id);
      return !!e && (e.id.toLowerCase().includes(lower) || e.label.toLowerCase().includes(lower));
    });
  }, [treeNodes, entriesByKey, lower]);

  const selectedIds = useMemo(
    () => (selected ? [...entriesByKey].filter(([, e]) => sameEntry(e, selected)).map(([k]) => k) : []),
    [entriesByKey, selected],
  );

  const treeRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    treeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  return (
    <div>
      <Input
        className={s.filterInput}
        aria-label="Filter registry"
        placeholder="Filter…"
        leadingAdornment={<SearchIcon />}
        value={filter}
        onChange={setFilter}
      />
      <Tree
        ref={treeRef}
        aria-label="Registry"
        nodes={filteredNodes}
        empty="No matches"
        expandedIds={lower ? treeBranchIds(filteredNodes) : openIds}
        onExpandedChange={lower ? undefined : setOpenIds}
        selectionMode="single"
        selectedIds={selectedIds}
        onAction={(id) => {
          const entry = entriesByKey.get(id);
          if (entry) onSelect(entry);
        }}
      />
    </div>
  );
}

const categoryKey = (n: TreeCategoryNode) => `cat:${n.id}`;
const groupKey = (id: string) => `group:${id}`;
const leafKey = (n: TreeCategoryNode, e: TreeEntry) => `${n.id}/${e.kind}:${e.id}`;
const sameEntry = (a: TreeEntry, b: TreeEntry) => a.kind === b.kind && a.id === b.id;

function countBadge(count: number, className?: string) {
  return <Badge className={className} shape="pill" size="sm" tone="neutral" variant="solid">{count}</Badge>;
}
