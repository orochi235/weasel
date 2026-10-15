// How the alternatives of a split value fold into one, by kind.

import { hexToRgba, interpolateSrgb, rgbaToHex } from '@weasel-js/paint';
import type { PrefWeighted } from './locus';
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
  let sum = 0;
  let total = 0;
  for (const { value, weight } of members) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return heaviest(members, leaf);
    sum += value * weight;
    total += weight;
  }
  return sum / total;
};

type Rgba = [number, number, number, number];

const blendColor: PrefBlend = (members, leaf) => {
  let mixed: Rgba | undefined;
  let total = 0;
  for (const { value, weight } of members) {
    let next: Rgba;
    try {
      next = hexToRgba(value as string);
    } catch {
      return heaviest(members, leaf);
    }
    total += weight;
    if (!mixed) {
      mixed = next;
      continue;
    }
    const t = weight / total;
    const [r, g, b] = interpolateSrgb([mixed[0], mixed[1], mixed[2]], [next[0], next[1], next[2]], t, 'oklch');
    mixed = [r, g, b, mixed[3] + (next[3] - mixed[3]) * t];
  }
  return rgbaToHex(mixed!);
};

/** The blends of the built-in kinds that have one. Every other kind takes its heaviest member. */
export const PREF_BLENDS: Readonly<Record<string, PrefBlend>> = { number: blendNumber, color: blendColor };

/**
 * The value `members` fold into for `leaf`: the member itself where one holds
 * all the weight, the leaf's default where none weighs anything, and otherwise
 * what the kind's blend makes of them. `blends` is keyed by `kind`, and one
 * given for a built-in kind replaces that kind's own.
 */
export function blendPref(leaf: PrefLeaf, members: readonly PrefWeighted[], blends?: Readonly<Record<string, PrefBlend>>): unknown {
  if (members.length === 0) return leaf.default;
  if (members.length === 1) return members[0]!.value;
  const blend = (blends && Object.hasOwn(blends, leaf.kind) ? blends[leaf.kind] : undefined)
    ?? (Object.hasOwn(PREF_BLENDS, leaf.kind) ? PREF_BLENDS[leaf.kind] : undefined)
    ?? heaviest;
  return blend(members, leaf);
}
