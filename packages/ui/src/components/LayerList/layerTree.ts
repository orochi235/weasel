import type { TreeDropTarget } from '../../dropTarget';
import type { LayerListItem, LayerMove } from './layerListProps';

type Items = readonly LayerListItem[];

/** Returns `items` with `move` applied, for a consumer that holds the tree as state. Layers the move leaves alone
 *  keep their identity. */
export function moveLayers(items: LayerListItem[], move: LayerMove): LayerListItem[] {
  const moving = new Set(move.ids);
  const taken = new Map<string, LayerListItem>();
  const lift = (list: LayerListItem[]): LayerListItem[] => {
    let changed = false;
    const out: LayerListItem[] = [];
    for (const it of list) {
      if (moving.has(it.id)) {
        taken.set(it.id, it);
        changed = true;
        continue;
      }
      const kids = it.children && lift(it.children);
      if (kids !== it.children) changed = true;
      out.push(kids === it.children ? it : { ...it, children: kids! });
    }
    return changed ? out : list;
  };
  const lifted = lift(items);
  const block = move.ids.flatMap((id) => taken.get(id) ?? []);
  const place = (list: LayerListItem[]): LayerListItem[] => {
    const at = Math.max(0, Math.min(list.length, move.index));
    return [...list.slice(0, at), ...block, ...list.slice(at)];
  };
  if (move.parentId === null) return place(lifted);
  const into = (list: LayerListItem[]): LayerListItem[] => {
    let changed = false;
    const out = list.map((it) => {
      if (it.id === move.parentId) {
        changed = true;
        return { ...it, children: place(it.children ?? []) };
      }
      const kids = it.children && into(it.children);
      if (kids === it.children) return it;
      changed = true;
      return { ...it, children: kids! };
    });
    return changed ? out : list;
  };
  return into(lifted);
}

export function collectCollapsed(
  items: Items,
  isCollapsed: (item: LayerListItem) => boolean,
  into = new Set<string>(),
): Set<string> {
  for (const item of items) {
    if (isCollapsed(item)) into.add(item.id);
    if (item.children) collectCollapsed(item.children, isCollapsed, into);
  }
  return into;
}

/** Every layer with children, shown or folded away, in list order. */
export function branchIds(items: Items, into: string[] = []): string[] {
  for (const item of items) {
    if (item.children?.length) {
      into.push(item.id);
      branchIds(item.children, into);
    }
  }
  return into;
}

export function findLayer(items: Items, id: string): LayerListItem | undefined {
  for (const it of items) {
    if (it.id === id) return it;
    const hit = it.children && findLayer(it.children, id);
    if (hit) return hit;
  }
  return undefined;
}

function siblingsAt(items: Items, parentId: string | null): Items {
  return parentId === null ? items : (findLayer(items, parentId)?.children ?? []);
}

/** A drop of `ids` at `target`, whose index counts them, as the move it makes, whose index does not. */
export function moveOf(items: Items, ids: readonly string[], target: TreeDropTarget): LayerMove {
  const moving = new Set(ids);
  const before = siblingsAt(items, target.parentId).slice(0, target.index).filter((it) => moving.has(it.id)).length;
  return { ids: [...ids], parentId: target.parentId, index: target.index - before };
}

/**
 * Whether dropping `ids` at `target` would cross a fixed row, a wall in the list it stands in. A row moving among
 * its own siblings stays between the walls it started between; a row from elsewhere lands between the outermost
 * walls, never past a fixed row at either end.
 */
export function crossesWall(items: Items, ids: readonly string[], target: TreeDropTarget): boolean {
  const sibs = siblingsAt(items, target.parentId);
  const walls = sibs.flatMap((it, i) => (it.fixed ? [i] : []));
  if (walls.length === 0) return false;
  const moving = new Set(ids);
  const segment = (i: number) => walls.filter((w) => w < i).length;
  const at = segment(target.index);
  const own = sibs.flatMap((it, i) => (moving.has(it.id) ? [i] : []));
  if (own.some((i) => segment(i) !== at)) return true;
  if (own.length === ids.length) return false;
  let lead = 0;
  while (sibs[lead]?.fixed) lead++;
  let trail = 0;
  while (sibs[sibs.length - 1 - trail]?.fixed) trail++;
  return target.index < lead || target.index > sibs.length - trail;
}
