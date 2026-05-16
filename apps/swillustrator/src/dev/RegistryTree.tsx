import { useMemo, useState } from 'react';
import s from './RegistryInspector.module.css';
import type { TreeCategoryNode, TreeEntry } from './registryData';

interface Props {
  nodes: readonly TreeCategoryNode[];
  selected: TreeEntry | null;
  onSelect(entry: TreeEntry): void;
}

export function RegistryTree({ nodes, selected, onSelect }: Props) {
  const [filter, setFilter] = useState('');
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
              {n.label} <span className={s.treeCount}>({n.entries.length})</span>
            </button>
            {isOpen(n.id) && (
              <ul className={s.treeLeaves}>
                {n.entries.map((e) => {
                  const isSelected = selected && selected.kind === e.kind && selected.id === e.id;
                  return (
                    <li key={`${e.kind}:${e.id}`}>
                      <button
                        type="button"
                        className={`${s.treeLeaf} ${isSelected ? s.treeLeafSelected : ''}`}
                        onClick={() => onSelect(e)}
                      >
                        {e.id}
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
