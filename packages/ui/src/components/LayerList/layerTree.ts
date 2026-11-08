import type { LayerListItem, LayerMove } from './layerListProps';

/** Returns `items` with `move` applied, for a consumer that holds the tree as state. */
export function moveLayers(items: LayerListItem[], move: LayerMove): LayerListItem[] {
  if (move.parentId === null) return reorder(items, move);
  return items.map((item) => {
    if (item.id === move.parentId) return { ...item, children: reorder(item.children ?? [], move) };
    return item.children ? { ...item, children: moveLayers(item.children, move) } : item;
  });
}

function reorder(siblings: LayerListItem[], { ids, index }: LayerMove): LayerListItem[] {
  const moving = new Set(ids);
  const kept = siblings.filter((it) => !moving.has(it.id));
  const moved = siblings.filter((it) => moving.has(it.id));
  const at = Math.max(0, Math.min(kept.length, index));
  return [...kept.slice(0, at), ...moved, ...kept.slice(at)];
}

export function collectCollapsed(
  items: LayerListItem[],
  isCollapsed: (item: LayerListItem) => boolean,
  into = new Set<string>(),
): Set<string> {
  for (const item of items) {
    if (isCollapsed(item)) into.add(item.id);
    if (item.children) collectCollapsed(item.children, isCollapsed, into);
  }
  return into;
}

export function anyNested(items: LayerListItem[]): boolean {
  return items.some((it) => (it.children?.length ?? 0) > 0);
}

/** Every layer showing, cards too, in drawn order: what a range selection runs across. */
export function showingIds(items: readonly LayerListItem[], collapsed: ReadonlySet<string>, into: string[] = []): string[] {
  for (const item of items) {
    into.push(item.id);
    if (item.children?.length && !collapsed.has(item.id)) showingIds(item.children, collapsed, into);
  }
  return into;
}
