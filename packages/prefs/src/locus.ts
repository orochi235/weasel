// A value held once per option of an enum leaf: the stored shape, and what
// reads and rewrites it. Nothing here knows a schema; the store supplies the
// options, the order, and how a member is repaired and blended.

import { isPlainObject } from '@weasel-js/registry';

/**
 * A leaf's value split by another leaf: one member for each option of the
 * `enum` leaf at `$by`. A member may itself be a locus, by a second selector.
 * The alternatives are folded by weight when the value is read, and a plain
 * setting of the selector gives one of them all of it.
 */
export interface PrefLocus {
  /** The full path of the `enum` leaf whose options key `$of`. */
  $by: string;
  $of: Record<string, unknown>;
}

/** A value for each selector a read is made under: its path, then the option chosen. */
export type PrefSelection = Readonly<Record<string, string>>;

/** A weight for each option of each selector, by the selector's path. An option left out weighs nothing. */
export type PrefWeights = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** One alternative of a split value, and its share of the whole. */
export interface PrefWeighted {
  value: unknown;
  weight: number;
}

/** Whether `value` is a {@link PrefLocus}: an object of exactly `$by` and `$of`. */
export function isPrefLocus(value: unknown): value is PrefLocus {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && typeof value.$by === 'string' && isPlainObject(value.$of);
}

/** The weights a plain selection amounts to: all of each selector's on the option chosen. */
export function selectionWeights(selection: PrefSelection): PrefWeights {
  return Object.fromEntries(Object.entries(selection).map(([path, option]) => [path, { [option]: 1 }]));
}

const member = (locus: PrefLocus, option: string, absent: unknown): unknown =>
  (Object.hasOwn(locus.$of, option) ? locus.$of[option] : absent);

/**
 * Every alternative of `stored` that weighs something under `weights`, each
 * with its share: the product of the weights on the way down to it. An option
 * the locus holds nothing for reads as `absent`. Members come in the order
 * `weights` lists each selector's options.
 */
export function weighLocus(stored: unknown, weights: PrefWeights, absent: unknown): PrefWeighted[] {
  const out: PrefWeighted[] = [];
  const walk = (value: unknown, weight: number): void => {
    if (!isPrefLocus(value)) {
      out.push({ value, weight });
      return;
    }
    for (const [option, share] of Object.entries(weights[value.$by] ?? {})) {
      if (share > 0) walk(member(value, option, absent), weight * share);
    }
  };
  walk(stored, 1);
  return out;
}

/** The one member `selection` names. A selector it leaves out, or an option the locus holds nothing for, reads as `absent`. */
export function memberAt(stored: unknown, selection: PrefSelection, absent: unknown): unknown {
  let value = stored;
  while (isPrefLocus(value)) {
    const option = selection[value.$by];
    if (option === undefined) return absent;
    value = member(value, option, absent);
  }
  return value;
}

/** `stored` with the member `selection` names replaced by `next`. A value that is not split is replaced whole. */
export function writeMember(stored: unknown, selection: PrefSelection, next: unknown): unknown {
  if (!isPrefLocus(stored)) return next;
  const option = selection[stored.$by];
  if (option === undefined) return stored;
  return { $by: stored.$by, $of: { ...stored.$of, [option]: writeMember(stored.$of[option], selection, next) } };
}

/**
 * `stored` split by the selector at `by`, every option starting as the value
 * it had. `order` is the leaf's `splitBy`: a selector earlier in it sits
 * outside a later one, so one meaning has one stored form.
 */
export function splitLocus(stored: unknown, by: string, options: readonly string[], order: readonly string[]): unknown {
  const across = (value: unknown): PrefLocus => ({ $by: by, $of: Object.fromEntries(options.map((option) => [option, value])) });
  if (!isPrefLocus(stored)) return across(stored);
  if (stored.$by === by) return stored;
  if (order.indexOf(stored.$by) > order.indexOf(by)) return across(stored);
  return mapMembers(stored, (inner) => splitLocus(inner, by, options, order));
}

/** `stored` no longer split by the selector at `by`: where it was, the member `selection` names stays. */
export function joinLocus(stored: unknown, by: string, selection: PrefSelection, absent: unknown): unknown {
  if (!isPrefLocus(stored)) return stored;
  if (stored.$by !== by) return mapMembers(stored, (inner) => joinLocus(inner, by, selection, absent));
  const option = selection[by];
  return option === undefined ? absent : member(stored, option, absent);
}

function mapMembers(locus: PrefLocus, fn: (member: unknown) => unknown): PrefLocus {
  let out: Record<string, unknown> | undefined;
  for (const [option, value] of Object.entries(locus.$of)) {
    const next = fn(value);
    if (next !== value) (out ??= { ...locus.$of })[option] = next;
  }
  return out ? { $by: locus.$by, $of: out } : locus;
}

/** `stored` with each alternative mapped, at any depth. The same value when no member changed. */
export function mapLocusMembers(stored: unknown, fn: (value: unknown) => unknown): unknown {
  return isPrefLocus(stored) ? mapMembers(stored, (inner) => mapLocusMembers(inner, fn)) : fn(stored);
}

/** The path of every selector `stored` is split by, outermost first. */
export function locusSelectors(stored: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (value: unknown): void => {
    if (!isPrefLocus(value)) return;
    out.add(value.$by);
    for (const inner of Object.values(value.$of)) walk(inner);
  };
  walk(stored);
  return out;
}

/**
 * What a stored locus reads as: each member repaired, and a key that is none
 * of its selector's options left out. `undefined` when it is split by a
 * selector not in `allowed`, by one `optionsOf` has no options for, or by the
 * same one twice on the way to a member.
 */
export function repairLocus(
  stored: unknown,
  allowed: readonly string[],
  optionsOf: (path: string) => readonly string[] | undefined,
  repairMember: (value: unknown) => unknown,
): unknown {
  const BAD = Symbol('bad');
  const walk = (value: unknown, met: readonly string[]): unknown => {
    if (!isPrefLocus(value)) return repairMember(value);
    const options = allowed.includes(value.$by) && !met.includes(value.$by) ? optionsOf(value.$by) : undefined;
    if (!options) return BAD;
    const of: Record<string, unknown> = {};
    for (const option of options) {
      if (!Object.hasOwn(value.$of, option)) continue;
      const read = walk(value.$of[option], [...met, value.$by]);
      if (read === BAD) return BAD;
      of[option] = read;
    }
    return { $by: value.$by, $of: of };
  };
  const read = walk(stored, []);
  return read === BAD ? undefined : read;
}
