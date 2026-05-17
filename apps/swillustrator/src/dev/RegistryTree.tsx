import { useMemo, useState } from 'react';
import { Badge } from '@orochi235/weasel-ui';
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

  return (
    <div>
      <input
        className={s.filterInput}
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={s.treeList}>
        {filteredNodes.map((n) => (
          <li key={n.id} className={s.treeCategory}>
            <button type="button" className={s.treeCategoryButton} onClick={() => toggle(n.id)}>
              <span className={s.treeChevron}>{isOpen(n.id) ? '▾' : '▸'}</span>
              {n.label} <Badge shape="pill" size="sm" tone="neutral" variant="subtle">{n.entries.length}</Badge>
            </button>
            {isOpen(n.id) && (
              <ul className={s.treeLeaves}>
                {n.entries.map((e) => {
                  const isSelected = selected && selected.kind === e.kind && selected.id === e.id;
                  const count = getCount?.(e);
                  return (
                    <li key={`${e.kind}:${e.id}`}>
                      <button
                        type="button"
                        className={`${s.treeLeaf} ${isSelected ? s.treeLeafSelected : ''}`}
                        onClick={() => onSelect(e)}
                      >
                        {e.label}
                        {count !== undefined && <> <Badge className={s.leafBadge} shape="pill" size="sm" tone="neutral" variant="subtle">{count}</Badge></>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
