import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@orochi235/weasel-ui';
import s from './RegistryInspector.module.css';
import type { TreeCategoryNode, TreeEntry } from './registryData';

type RenderItem =
  | { kind: 'category'; node: TreeCategoryNode }
  | { kind: 'group'; id: string; label: string; nodes: readonly TreeCategoryNode[] };

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
  const selectedCategoryId = useMemo(() => {
    if (!selected) return null;
    const node = nodes.find((n) => n.entries.some(
      (e) => e.kind === selected.kind && e.id === selected.id,
    ));
    return node?.id ?? null;
  }, [nodes, selected]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    setOpenIds((cur) => {
      if (cur.has(selectedCategoryId)) return cur;
      const next = new Set(cur);
      next.add(selectedCategoryId);
      return next;
    });
  }, [selectedCategoryId]);

  const selectedLeafRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selectedLeafRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const lower = filter.trim().toLowerCase();

  const filteredNodes = useMemo(() => {
    if (!lower) return nodes;
    return nodes
      .map((n) => ({
        ...n,
        entries: n.entries.filter(
          (e) => e.id.toLowerCase().includes(lower) || e.label.toLowerCase().includes(lower),
        ),
      }))
      .filter((n) => n.entries.length > 0);
  }, [nodes, lower]);

  const isOpen = (id: string) => (lower ? true : openIds.has(id));
  const toggle = (id: string) => {
    if (lower) return;
    setOpenIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItems = useMemo<readonly RenderItem[]>(() => {
    const out: RenderItem[] = [];
    const groupsSeen = new Map<string, { kind: 'group'; id: string; label: string; nodes: TreeCategoryNode[] }>();
    for (const node of filteredNodes) {
      if (!node.group) {
        out.push({ kind: 'category', node });
        continue;
      }
      let item = groupsSeen.get(node.group.id);
      if (!item) {
        item = { kind: 'group', id: node.group.id, label: node.group.label, nodes: [] };
        groupsSeen.set(node.group.id, item);
        out.push(item);
      }
      item.nodes.push(node);
    }
    return out;
  }, [filteredNodes]);

  const renderCategory = (n: TreeCategoryNode): ReactNode => (
    <li key={n.id} className={s.treeCategory}>
      <button type="button" className={s.treeCategoryButton} onClick={() => toggle(n.id)}>
        <span className={s.treeChevron}>{isOpen(n.id) ? '▾' : '▸'}</span>
        {n.label} <Badge shape="pill" size="sm" tone="neutral" variant="solid">{n.entries.length}</Badge>
      </button>
      {isOpen(n.id) && (
        <ul className={s.treeLeaves}>
          {n.entries.map((e) => {
            const isSelected = selected && selected.kind === e.kind && selected.id === e.id;
            const count = getCount?.(e);
            const libBadge = e.kind === 'publicExport' && e.source === 'ui'
              ? <Badge className={s.leafBadge} shape="pill" size="sm" tone="info" variant="solid">UI</Badge>
              : null;
            return (
              <li key={`${e.kind}:${e.id}`}>
                <button
                  ref={isSelected ? selectedLeafRef : undefined}
                  type="button"
                  className={`${s.treeLeaf} ${isSelected ? s.treeLeafSelected : ''}`}
                  onClick={() => onSelect(e)}
                >
                  {e.label}
                  {libBadge && <> {libBadge}</>}
                  {count !== undefined && <> <Badge className={s.leafBadge} shape="pill" size="sm" tone="neutral" variant="solid">{count}</Badge></>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );

  return (
    <div>
      <input
        className={s.filterInput}
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={s.treeList}>
        {renderItems.map((item) =>
          item.kind === 'group' ? (
            <li key={`group:${item.id}`} className={s.treeGroup}>
              <div className={s.treeGroupHeading}>{item.label}</div>
              <ul className={s.treeList}>
                {item.nodes.map((node) => renderCategory(node))}
              </ul>
            </li>
          ) : (
            renderCategory(item.node)
          ),
        )}
      </ul>
    </div>
  );
}
