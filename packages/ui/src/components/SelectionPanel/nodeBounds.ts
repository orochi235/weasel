import { prefClampNumber, prefNumberAt, type PrefLeaf, type PrefNumber } from '@weasel-js/prefs';
import { nodeValueAt, type AnyNode } from './model';

/** `leaf` as it bounds `node`: a number leaf's `minAt` and `maxAt` read against the node's own values. */
export function leafAtNode(leaf: PrefLeaf, node: AnyNode): PrefLeaf {
  return leaf.kind === 'number' ? prefNumberAt(leaf as PrefNumber, (path) => nodeValueAt(node, path)) : leaf;
}

/** What a write of `value` stores into `node` at `leaf`: a number held to that node's bounds. */
export function boundAtNode(leaf: PrefLeaf, node: AnyNode, value: unknown): unknown {
  return typeof value === 'number' && leaf.kind === 'number' ? prefClampNumber(leafAtNode(leaf, node) as PrefNumber, value) : value;
}

/**
 * `leaf` as one control over `nodes` draws it: each node's own bounds, and
 * across several the loosest of them, so a value one node may take is not
 * refused for another's sake. Each write is then held to its node's own.
 */
export function leafAcross(leaf: PrefLeaf, nodes: readonly AnyNode[]): PrefLeaf {
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
