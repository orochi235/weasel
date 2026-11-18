// Tests a schema reads from a node's own group, turned into tests read from the root, so every reader of conditions
// sees root paths and a group can be mounted anywhere.

import { prefConditionInGroup, type PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';

const CONDITIONS = ['showIf', 'enableIf', 'activeIf'] as const;

type Node = Record<string, unknown>;

const resolved = new WeakMap<object, object>();

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);
const isGroup = (node: Node): boolean => !('kind' in node) && isNode(node.children);
const under = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

/** `held` with `each` put through every node in it, the object itself where none changes. */
function mapNodes(held: Node, each: (key: string, node: Node) => Node): Node {
  let out: Node | undefined;
  for (const [key, child] of Object.entries(held)) {
    if (!isNode(child)) continue;
    const next = each(key, child);
    if (next === child) continue;
    out ??= { ...held };
    out[key] = next;
  }
  return out ?? held;
}

/**
 * `node`, declared in the group at `group`, with its conditions read from the root, and everything under it likewise.
 * `path` is the node's own path, which a group's children are declared in. Groups sit only in groups; a section's
 * members, a leaf's fields and its item sit in the group their holder does.
 */
function resolveNode(node: Node, group: string, path: string): Node {
  let out: Node | undefined;
  const set = (key: string, value: unknown) => {
    out ??= { ...node };
    out[key] = value;
  };
  for (const key of CONDITIONS) {
    const condition = node[key] as PrefCondition | undefined;
    if (condition === undefined) continue;
    const next = prefConditionInGroup(condition, group);
    if (next !== condition) set(key, next);
  }
  const inGroup = (_key: string, child: Node) => resolveNode(child, group, path);
  if (isNode(node.children)) {
    const children = isGroup(node)
      ? mapNodes(node.children, (key, child) => resolveNode(child, path, under(path, key)))
      : mapNodes(node.children, inGroup);
    if (children !== node.children) set('children', children);
  }
  if (isNode(node.members)) {
    const members = mapNodes(node.members, inGroup);
    if (members !== node.members) set('members', members);
  }
  if (isNode(node.item)) {
    const item = resolveNode(node.item, group, path);
    if (item !== node.item) set('item', item);
  }
  if (isNode(node.variants)) {
    const variants = mapNodes(node.variants, inGroup);
    if (variants !== node.variants) set('variants', variants);
  }
  return out ?? node;
}

/**
 * `schema` with every condition test read from its node's group (`from: 'group'`) read from the root instead: the
 * form the condition readers, the status walks and the store's checks take. The same object comes back for the same
 * schema, and the schema itself where no test reads from its group.
 */
export function resolvePrefGroupConditions<T extends PrefGroup | PrefSection>(schema: T): T {
  const known = resolved.get(schema);
  if (known !== undefined) return known as T;
  const out = resolveNode(schema as unknown as Node, '', '') as unknown as T;
  resolved.set(schema, out);
  return out;
}
