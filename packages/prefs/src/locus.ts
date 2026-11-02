// A value held once per option of an enum leaf: the stored shape, and what
// reads and rewrites it. Nothing here knows a schema; the store supplies the
// options, the order, which options keep their own member, and how a member
// is repaired and blended.

import { isPlainObject } from '@weasel-js/registry';

/** The key of a locus's shared member: what every option without a member of its own reads and writes. */
export const TBD_REST_KEY = '$else';

/**
 * A leaf's value split by another leaf: one member for each option of the
 * `enum` leaf at `$by`, or of a selector that is no leaf, whose option the app names.
 * A member may itself be a locus, by a second selector. The alternatives are
 * folded by weight when the value is read, and a plain setting of the
 * selector gives one of them all of it.
 */
export interface PrefLocus {
  /** The full path of the selector whose options key `$in`. */
  $by: string;
  $in: Record<string, unknown>;
  /** The member shared by every option that keeps none of its own. */
  [TBD_REST_KEY]?: unknown;
}

/** A closed selector's list: the options that keep a member of their own, and the value each reads before one is written, where proposed. */
export interface TbdClosed {
  readonly options: readonly string[];
  readonly proposed: Readonly<Record<string, unknown>>;
}

/**
 * The closed selectors of a leaf, by path. Every option a closed list leaves
 * out shares the locus's {@link TBD_REST_KEY} member. A selector left out is
 * open: an option keeps a member once one is written for it, and reads the
 * shared one until then.
 */
export type TbdClosedLists = Readonly<Record<string, TbdClosed>>;

/** A value for each selector a read is made under: its path, then the option chosen. */
export type PrefSelection = Readonly<Record<string, string>>;

/** A weight for each option of each selector, by the selector's path. An option left out weighs nothing. */
export type PrefWeights = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** One alternative of a split value, and its share of the whole. */
export interface PrefWeighted {
  value: unknown;
  weight: number;
}

const hasRest = (locus: PrefLocus): boolean => Object.hasOwn(locus, TBD_REST_KEY);
const restOr = (locus: PrefLocus, absent: unknown): unknown => (hasRest(locus) ? locus[TBD_REST_KEY] : absent);
const withRest = (locus: PrefLocus, rest: unknown): PrefLocus => ({ ...locus, [TBD_REST_KEY]: rest });

/** Whether `value` is a {@link PrefLocus}: an object of `$by` and `$in`, and the shared member if any, and nothing else. */
export function isPrefLocus(value: unknown): value is PrefLocus {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).length - (Object.hasOwn(value, TBD_REST_KEY) ? 1 : 0);
  return keys === 2 && typeof value.$by === 'string' && isPlainObject(value.$in);
}

/**
 * `value` with every locus in it that was stored as `{ $by, $of }`, the shape
 * before the members' key was renamed, in the current shape. The same value
 * when it holds none.
 */
export function upgradeLocus(value: unknown): unknown {
  if (isPrefLocus(value)) return mapMembers(value, upgradeLocus);
  const old = isPlainObject(value) && Object.keys(value).length === 2 && typeof value.$by === 'string' && isPlainObject(value.$of);
  return old ? mapMembers({ $by: value.$by as string, $in: value.$of as Record<string, unknown> }, upgradeLocus) : value;
}

/** The weights a plain selection amounts to: all of each selector's on the option chosen. */
export function selectionWeights(selection: PrefSelection): PrefWeights {
  return Object.fromEntries(Object.entries(selection).map(([path, option]) => [path, { [option]: 1 }]));
}

/** Whether `option` of the locus's selector is one a closed list leaves out, which shares the shared member. */
const shares = (locus: PrefLocus, option: string, closed: TbdClosedLists | undefined): boolean => {
  const list = closed?.[locus.$by];
  return list !== undefined && !list.options.includes(option);
};

/**
 * What one option of the locus's own selector reads: its own member where it
 * has one and may (an option a closed list leaves out never does); else,
 * for an option a closed list proposes a value for, that; else the shared
 * member. No option named reads the shared member too. Whatever is held
 * nothing for reads as `absent`.
 */
export function locusMember(locus: PrefLocus, option: string | undefined, absent: unknown, closed?: TbdClosedLists): unknown {
  if (option === undefined || shares(locus, option, closed)) return restOr(locus, absent);
  if (Object.hasOwn(locus.$in, option)) return locus.$in[option];
  const proposed = closed?.[locus.$by]?.proposed;
  return proposed && Object.hasOwn(proposed, option) ? proposed[option] : restOr(locus, absent);
}

/**
 * Every alternative of `stored` that weighs something under `weights`, each
 * with its share: the product of the weights on the way down to it. An option
 * the locus holds nothing for reads as `absent`, and a selector `weights`
 * leaves out reads the shared member, or nothing where there is none. Members come in the order `weights`
 * lists each selector's options.
 */
export function weighLocus(stored: unknown, weights: PrefWeights, absent: unknown, closed?: TbdClosedLists): PrefWeighted[] {
  const out: PrefWeighted[] = [];
  const walk = (value: unknown, weight: number): void => {
    if (!isPrefLocus(value)) {
      out.push({ value, weight });
      return;
    }
    const given = weights[value.$by];
    if (given === undefined) {
      if (hasRest(value)) walk(value[TBD_REST_KEY], weight);
      return;
    }
    for (const [option, share] of Object.entries(given)) {
      if (share > 0) walk(locusMember(value, option, absent, closed), weight * share);
    }
  };
  walk(stored, 1);
  return out;
}

/** The one member `selection` names. A selector it leaves out reads the shared member; an option the locus holds nothing for reads as `absent`. */
export function memberAt(stored: unknown, selection: PrefSelection, absent: unknown, closed?: TbdClosedLists): unknown {
  let value = stored;
  while (isPrefLocus(value)) value = locusMember(value, selection[value.$by], absent, closed);
  return value;
}

/**
 * `stored` with the member `selection` names replaced by `next`: the one a
 * read under it comes from, except that an option that may keep a member of
 * its own has one from then on. A selector `selection` leaves out writes the
 * shared member. A value that is not split is replaced whole.
 */
export function writeMember(stored: unknown, selection: PrefSelection, next: unknown, closed?: TbdClosedLists): unknown {
  if (!isPrefLocus(stored)) return next;
  const option = selection[stored.$by];
  if (option === undefined || shares(stored, option, closed)) return withRest(stored, writeMember(stored[TBD_REST_KEY], selection, next, closed));
  return { ...stored, $in: { ...stored.$in, [option]: writeMember(stored.$in[option], selection, next, closed) } };
}

/** `stored` without the members of options a closed list leaves out, which no read reaches, at any depth. The same value when there are none. */
export function dropUnlisted(stored: unknown, closed: TbdClosedLists | undefined): unknown {
  if (!closed || !isPrefLocus(stored)) return stored;
  const list = closed[stored.$by]?.options;
  const stale = list ? Object.keys(stored.$in).filter((option) => !list.includes(option)) : [];
  const kept = stale.length ? { ...stored, $in: Object.fromEntries(Object.entries(stored.$in).filter(([option]) => list!.includes(option))) } : stored;
  return mapMembers(kept, (inner) => dropUnlisted(inner, closed));
}

/**
 * `stored` split by the selector at `by`, every option starting as the value
 * it had. `order` is the leaf's `splitBy`: a selector earlier in it sits
 * outside a later one, so one meaning has one stored form.
 */
export function splitLocus(stored: unknown, by: string, options: readonly string[], order: readonly string[]): unknown {
  const across = (value: unknown): PrefLocus => ({ $by: by, $in: Object.fromEntries(options.map((option) => [option, value])) });
  if (!isPrefLocus(stored)) return across(stored);
  if (stored.$by === by) return stored;
  if (order.indexOf(stored.$by) > order.indexOf(by)) return across(stored);
  return mapMembers(stored, (inner) => splitLocus(inner, by, options, order));
}

/** `stored` no longer split by the selector at `by`: where it was, the member `selection` names stays. */
export function joinLocus(stored: unknown, by: string, selection: PrefSelection, absent: unknown, closed?: TbdClosedLists): unknown {
  if (!isPrefLocus(stored)) return stored;
  if (stored.$by !== by) return mapMembers(stored, (inner) => joinLocus(inner, by, selection, absent, closed));
  return locusMember(stored, selection[by], absent, closed);
}

function mapMembers(locus: PrefLocus, fn: (member: unknown) => unknown): PrefLocus {
  let out: Record<string, unknown> | undefined;
  for (const [option, value] of Object.entries(locus.$in)) {
    const next = fn(value);
    if (next !== value) (out ??= { ...locus.$in })[option] = next;
  }
  const mapped = out ? { ...locus, $in: out } : locus;
  if (!hasRest(locus)) return mapped;
  const rest = fn(locus[TBD_REST_KEY]);
  return rest === locus[TBD_REST_KEY] ? mapped : withRest(mapped, rest);
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
    for (const inner of Object.values(value.$in)) walk(inner);
    if (hasRest(value)) walk(value[TBD_REST_KEY]);
  };
  walk(stored);
  return out;
}

/**
 * What a stored locus reads as: each member repaired, and left out a key that
 * is none of its selector's options or one a closed list leaves out.
 * `optionsOf` gives a selector's options, `null` for a selector that is no leaf, whose
 * keys are all kept. `undefined` when it is split by a selector not in
 * `allowed`, by one `optionsOf` has no options for, or by the same one twice
 * on the way to a member.
 */
export function repairLocus(
  stored: unknown,
  allowed: readonly string[],
  optionsOf: (path: string) => readonly string[] | null | undefined,
  repairMember: (value: unknown) => unknown,
  closed?: TbdClosedLists,
): unknown {
  const BAD = Symbol('bad');
  const walk = (value: unknown, met: readonly string[]): unknown => {
    if (!isPrefLocus(value)) return repairMember(value);
    const options = allowed.includes(value.$by) && !met.includes(value.$by) ? optionsOf(value.$by) : undefined;
    if (options === undefined) return BAD;
    const inner = [...met, value.$by];
    const kept: [string, unknown][] = [];
    for (const option of options ?? Object.keys(value.$in)) {
      if (!Object.hasOwn(value.$in, option) || shares(value, option, closed)) continue;
      const read = walk(value.$in[option], inner);
      if (read === BAD) return BAD;
      kept.push([option, read]);
    }
    const out: PrefLocus = { $by: value.$by, $in: Object.fromEntries(kept) };
    if (!hasRest(value)) return out;
    const rest = walk(value[TBD_REST_KEY], inner);
    return rest === BAD ? BAD : withRest(out, rest);
  };
  const read = walk(stored, []);
  return read === BAD ? undefined : read;
}
