import { isPlainObject } from '@weasel-js/core';
import {
  isPrefLeaf, prefClampNumber, prefNumberAt, prefSectionLeaves,
  type PrefLeaf, type PrefNumber, type PrefObject, type PrefSection,
} from '@weasel-js/prefs';
import { nodeValueAt, type AnyNode } from './model';

/** `leaf` as it bounds `node`: a number leaf's `minAt` and `maxAt` read against the node's own values. */
export function leafAtNode(leaf: PrefLeaf, node: AnyNode): PrefLeaf {
  return leaf.kind === 'number' ? prefNumberAt(leaf as PrefNumber, (path) => nodeValueAt(node, path)) : leaf;
}

/**
 * What a write of `value` stores into `node` at `leaf`: a number held to that
 * node's bounds, and an object with each field the write changed from `held`
 * held to its own.
 */
export function boundAtNode(leaf: PrefLeaf, node: AnyNode, value: unknown, held?: unknown): unknown {
  if (leaf.kind === 'object') return objectAtNode(leaf as PrefObject, node, value, held);
  return typeof value === 'number' && leaf.kind === 'number' ? prefClampNumber(leafAtNode(leaf, node) as PrefNumber, value) : value;
}

function objectAtNode(leaf: PrefObject, node: AnyNode, value: unknown, held: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const before = isPlainObject(held) ? held : undefined;
  let out: Record<string, unknown> = value;
  for (const [key, field] of prefSectionLeaves(leaf.children)) {
    const given = value[key];
    if (before !== undefined && given === before[key]) continue;
    const bound = boundAtNode(field, node, given, before?.[key]);
    if (bound === given) continue;
    if (out === value) out = { ...value };
    out[key] = bound;
  }
  return out;
}

/** `children` with each leaf replaced by what `fn` makes of it, sections kept; the same object when none changed. */
function mapFields(children: PrefObject['children'], fn: (leaf: PrefLeaf) => PrefLeaf): PrefObject['children'] {
  let out: PrefObject['children'] | undefined;
  for (const [key, child] of Object.entries(children)) {
    const next = isPrefLeaf(child) ? fn(child) : mapSection(child, fn);
    if (next === child) continue;
    out ??= { ...children };
    out[key] = next;
  }
  return out ?? children;
}

function mapSection(section: PrefSection, fn: (leaf: PrefLeaf) => PrefLeaf): PrefSection {
  const members = mapFields(section.members, fn);
  return members === section.members ? section : { ...section, members };
}

/**
 * `leaf` as one control over `nodes` draws it: each node's own bounds, and
 * across several the loosest of them, so a value one node may take is not
 * refused for another's sake. Each write is then held to its node's own. An
 * object leaf has its fields drawn so.
 */
export function leafAcross(leaf: PrefLeaf, nodes: readonly AnyNode[]): PrefLeaf {
  if (leaf.kind === 'object') {
    const object = leaf as PrefObject;
    const children = mapFields(object.children, (field) => leafAcross(field, nodes));
    return children === object.children ? leaf : ({ ...object, children } as PrefLeaf);
  }
  if (leaf.kind !== 'number') return leaf;
  const { minAt, maxAt } = leaf as PrefNumber;
  if ((minAt === undefined && maxAt === undefined) || nodes.length === 0) return leaf;
  const each = nodes.map((node) => leafAtNode(leaf, node) as PrefNumber);
  const loosest = (pick: (n: PrefNumber) => number | undefined, by: (...xs: number[]) => number): number | undefined => {
    const bounds = each.map(pick);
    return bounds.some((b) => b === undefined) ? undefined : by(...(bounds as number[]));
  };
  const { minAt: _min, maxAt: _max, min: _lo, max: _hi, ...rest } = leaf as PrefNumber;
  const min = loosest((n) => n.min, Math.min);
  const max = loosest((n) => n.max, Math.max);
  return { ...rest, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) } as PrefLeaf;
}
