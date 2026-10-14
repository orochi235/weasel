// Which leaves a schema lets a value be split by, and what is wrong with a
// `splitBy` that names something else: what a store warns of.

import type { PrefGroup } from './groups';
import { prefHoldsValue, prefLeaves } from './helpers';
import { locusSelectors } from './locus';
import type { PrefEnum, PrefLeaf } from './schema';

/** One thing wrong with a leaf's `splitBy`. */
export interface PrefSplitProblem {
  code: 'valueless' | 'no-leaf' | 'not-enum' | 'encoded' | 'clearable' | 'split' | 'twice' | 'default';
  /** The path of the leaf whose `splitBy` it is. */
  at: string;
  /** The entry of `splitBy` the problem is with, where it is with one. */
  path?: string;
  problem: string;
}

const refusal = (leaf: PrefLeaf | undefined): [PrefSplitProblem['code'], string] | undefined => {
  if (!leaf) return ['no-leaf', 'names no leaf'];
  if (leaf.kind !== 'enum') return ['not-enum', `names a ${leaf.kind} leaf, and only an enum has options to split by`];
  const selector = leaf as PrefEnum;
  if (selector.encoding) return ['encoded', 'names an enum with an encoding, whose stored value is not its option'];
  if (selector.clearable) return ['clearable', 'names a clearable enum, which may hold none of its options'];
  if (selector.splitBy?.length) return ['split', 'names a leaf that may itself be split'];
  return undefined;
};

/** The options of the leaf at each path some leaf of `leaves` may be split by, for the paths that can be. */
export function prefSelectors(leaves: ReadonlyMap<string, PrefLeaf>): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const leaf of leaves.values()) {
    for (const path of leaf.splitBy ?? []) {
      const selector = leaves.get(path);
      if (out.has(path) || refusal(selector)) continue;
      out.set(path, (selector as PrefEnum).options.map((option) => option.value));
    }
  }
  return out;
}

/** Everything wrong with the `splitBy` lists of `schema`'s leaves, in schema order. */
export function checkPrefSplits(schema: PrefGroup): PrefSplitProblem[] {
  const leaves = prefLeaves(schema);
  const out: PrefSplitProblem[] = [];
  for (const [at, leaf] of leaves) {
    for (const path of locusSelectors(leaf.defaultLocus)) {
      if (leaf.splitBy?.includes(path)) continue;
      out.push({ code: 'default', at, path, problem: `its defaultLocus is split by "${path}", which its splitBy does not list` });
    }
    if (!leaf.splitBy?.length) continue;
    if (!prefHoldsValue(leaf)) {
      out.push({ code: 'valueless', at, problem: `a ${leaf.kind} leaf holds no value to split` });
      continue;
    }
    leaf.splitBy.forEach((path, i) => {
      if (leaf.splitBy!.indexOf(path) !== i) {
        out.push({ code: 'twice', at, path, problem: `"${path}" is listed twice` });
        return;
      }
      const why = refusal(leaves.get(path));
      if (why) out.push({ code: why[0], at, path, problem: `"${path}" ${why[1]}` });
    });
  }
  return out;
}
