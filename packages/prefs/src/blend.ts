// How the alternatives of a split value fold into one, by kind.

import { hexToRgba, mixRgbaWeighted, rgbaToHex } from '@weasel-js/paint';
import type { PrefWeighted } from './scope';
import type { PrefLeaf } from './schema';

/**
 * Folds a split value's alternatives into the one value read. `members` holds
 * two or more, each weighing more than nothing, and their weights need not
 * sum to 1.
 */
export type PrefBlend = (members: readonly PrefWeighted[], leaf: PrefLeaf) => unknown;

/** The first of the members that weigh the most. */
const heaviest: PrefBlend = (members) => members.reduce((most, m) => (m.weight > most.weight ? m : most)).value;

const blendNumber: PrefBlend = (members, leaf) => {
  let most = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const { value, weight } of members) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return heaviest(members, leaf);
    most = Math.max(most, weight);
    lo = Math.min(lo, value);
    hi = Math.max(hi, value);
  }
  // Scaled to the heaviest so no product or total overflows, and held to the
  // members' range, which rounding would otherwise leave by an ulp.
  let total = 0;
  for (const { weight } of members) total += weight / most;
  let sum = 0;
  for (const { value, weight } of members) sum += (value as number) * (weight / most / total);
  return Math.min(hi, Math.max(lo, sum));
};

const blendColor: PrefBlend = (members, leaf) => {
  try {
    return rgbaToHex(mixRgbaWeighted(members.map(({ value, weight }) => ({ color: hexToRgba(value as string), weight }))));
  } catch {
    return heaviest(members, leaf);
  }
};

/** The blends of the built-in kinds that have one. Every other kind takes its heaviest member. */
export const PREF_BLENDS: Readonly<Record<string, PrefBlend>> = { number: blendNumber, color: blendColor };

/**
 * `members` as a blend takes them: where any weighs infinitely, those alone at
 * equal weight, the limit of an ever-heavier weight; where a product of
 * nested weights underflowed so that none weighs anything, all at equal weight.
 */
function foldWeights(members: readonly PrefWeighted[]): readonly PrefWeighted[] {
  if (members.some((m) => m.weight === Infinity)) return members.filter((m) => m.weight === Infinity).map((m) => ({ value: m.value, weight: 1 }));
  if (members.every((m) => m.weight === 0)) return members.map((m) => ({ value: m.value, weight: 1 }));
  return members;
}

/**
 * The value `members` fold into for `leaf`: the member itself where one holds
 * all the weight, the leaf's default where none weighs anything, and otherwise
 * what the kind's blend makes of them. `blends` is keyed by `kind`, and one
 * given for a built-in kind replaces that kind's own.
 */
export function blendPref(leaf: PrefLeaf, members: readonly PrefWeighted[], blends?: Readonly<Record<string, PrefBlend>>): unknown {
  if (members.length === 0) return leaf.default;
  if (members.length === 1) return members[0]!.value;
  const folded = foldWeights(members);
  if (folded.length === 1) return folded[0]!.value;
  const blend = (blends && Object.hasOwn(blends, leaf.kind) ? blends[leaf.kind] : undefined)
    ?? (Object.hasOwn(PREF_BLENDS, leaf.kind) ? PREF_BLENDS[leaf.kind] : undefined)
    ?? heaviest;
  return blend(folded, leaf);
}
