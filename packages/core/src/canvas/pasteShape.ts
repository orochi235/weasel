/** The shape a paste needs of clipboard items, which arrive as text any app can write. */
import { nodeShapeFault } from 'core/scene/snapshotShape';
import type { Bounds } from '../core/viewport/fitViewToBounds';

const finite = (b: Bounds): boolean =>
  Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height);

/** Whether the descriptor reads finite bounds from `pose`. It is written for poses its scene made, so one it throws
 *  on reading is one it cannot place. */
function placeable(pose: unknown, node: unknown, poseBounds: (pose: unknown, node: unknown) => Bounds): boolean {
  if (typeof pose !== 'object') return false;
  try {
    return finite(poseBounds(pose, node));
  } catch {
    return false;
  }
}

/** What is wrong with `items` as a copy to paste into a scene with `layers`, or `null` when it can be pasted: each a
 *  saved node on one of those layers whose pose has finite bounds, no two with one id, and no parent chain a loop. */
export function clipboardFault(
  items: unknown,
  layers: ReadonlySet<string>,
  poseBounds: (pose: unknown, node: unknown) => Bounds,
): string | null {
  if (!Array.isArray(items)) return 'its items are not a list';
  const parents = new Map<string, unknown>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    const fault = nodeShapeFault(item);
    if (fault) return `item ${i} ${fault}`;
    const id = item.id as string;
    if (parents.has(id)) return `two items have the id "${id}"`;
    if (!layers.has(item.layer as string)) return `item "${id}" is on a layer this scene has not got`;
    if (!placeable(item.pose, item, poseBounds)) return `item "${id}" has a pose with no finite bounds`;
    if (item.children !== undefined && !(Array.isArray(item.children) && item.children.every((c) => typeof c === 'string'))) {
      return `item "${id}" has \`children\` that are not a list of ids`;
    }
    parents.set(id, item.parent);
  }
  const rooted = new Set<unknown>();
  for (const start of parents.keys()) {
    const chain = new Set<unknown>();
    for (let at: unknown = start; parents.has(at as string) && !rooted.has(at); at = parents.get(at as string)) {
      if (chain.has(at)) return `item "${start}" is its own ancestor`;
      chain.add(at);
    }
    for (const id of chain) rooted.add(id);
  }
  return null;
}
