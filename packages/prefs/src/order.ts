import type { PrefActions } from './action';
import type { PrefGroup } from './groups';
import { isPrefLeaf } from './helpers';
import type { PrefLeaf } from './schema';

/**
 * Stored orders by container path: `''` for a group's top level, a nested
 * group's dotted path, or an `actions` leaf's path. Each list names child keys
 * (the last path segment) or, for an `actions` leaf, action keys.
 */
export type PrefOrder = Readonly<Record<string, readonly string[]>>;

/**
 * `keys` in the order `stored` gives. A stored key that no longer exists is
 * dropped. A key the store lacks goes at its place in `keys` (`schema`, held
 * to the end of the list) or last (`end`).
 */
export function resolveOrder(
  keys: readonly string[],
  stored: readonly string[] | undefined,
  missing: 'schema' | 'end',
): string[] {
  const known = new Set(keys);
  const out = [...new Set(stored?.filter((k) => known.has(k)))];
  const placed = new Set(out);
  keys.forEach((key, index) => {
    if (placed.has(key)) return;
    if (missing === 'end') out.push(key);
    else out.splice(Math.min(index, out.length), 0, key);
  });
  return out;
}

const join = (path: string, key: string): string => (path ? `${path}.${key}` : key);

const storedAt = (order: PrefOrder, path: string): readonly string[] | undefined => (Object.hasOwn(order, path) ? order[path] : undefined);

/**
 * `group` with its children, and each nested group's, reordered by `order`,
 * and each `actions` leaf given its `order`. Nothing is added or dropped, and
 * `group` is not changed. Any subtree the order leaves as it was comes back
 * as the same object.
 */
export function orderPrefGroup(group: PrefGroup, order: PrefOrder | undefined, path = ''): PrefGroup {
  if (!order) return group;
  const keys = Object.keys(group.children);
  const sorted = resolveOrder(keys, storedAt(order, path), 'schema');
  let changed = sorted.some((key, i) => key !== keys[i]);
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const key of sorted) {
    const child = group.children[key]!;
    const next = orderChild(child, order, join(path, key));
    if (next !== child) changed = true;
    children[key] = next;
  }
  return changed ? { ...group, children } : group;
}

function orderChild(child: PrefLeaf | PrefGroup, order: PrefOrder, path: string): PrefLeaf | PrefGroup {
  if (!isPrefLeaf(child)) return orderPrefGroup(child, order, path);
  const stored = storedAt(order, path);
  if (child.kind !== 'actions' || !stored) return child;
  return { ...(child as PrefActions), order: stored };
}
