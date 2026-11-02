// A value held once per option of an enum leaf: the stored shape, and what
// reads and rewrites it. Nothing here knows a schema; the store supplies the
// options, the order, which options keep their own value, and how a value
// is repaired and blended.

import { isPlainObject } from '@weasel-js/registry';

/** The key of a scope's shared value: what every option without a value of its own reads and writes. */
export const PREF_ELSE = '$else';

/**
 * A pref's value split by another leaf: one value for each option of the
 * `enum` leaf at `$by`, or of a selector that is no leaf, whose option the app names.
 * A value may itself be a scope, by a second selector. The alternatives are
 * folded by weight when the value is read, and a plain setting of the
 * selector gives one of them all of it.
 */
export interface PrefScope {
  /** The full path of the selector whose options key `$in`. */
  $by: string;
  $in: Record<string, unknown>;
  /** The value shared by every option that keeps none of its own. */
  [PREF_ELSE]?: unknown;
}

/**
 * One override list of a pref's scope: the options of its selector that keep
 * a value of their own, by name, or by name with the value each reads before
 * one is written. A selector given one is overridesOf; every option it leaves out
 * shares the scope's {@link PREF_ELSE} value. A selector given none is open:
 * an option keeps a value of its own once one is written for it.
 */
export type PrefOverrides = readonly string[] | Readonly<Record<string, unknown>>;

/** A pref's override list for each selector, where it gives one. */
export type OverridesOf = (selector: string) => PrefOverrides | undefined;

const named = (overrides: PrefOverrides): overrides is readonly string[] => Array.isArray(overrides);

/** The options an override list names. */
export function overrideOptions(overrides: PrefOverrides): readonly string[] {
  return named(overrides) ? overrides : Object.keys(overrides);
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

const hasRest = (scope: PrefScope): boolean => Object.hasOwn(scope, PREF_ELSE);
const restOr = (scope: PrefScope, absent: unknown): unknown => (hasRest(scope) ? scope[PREF_ELSE] : absent);
const withRest = (scope: PrefScope, rest: unknown): PrefScope => ({ ...scope, [PREF_ELSE]: rest });

/** Whether `value` is a {@link PrefScope}: an object of `$by` and `$in`, and the shared value if any, and nothing else. */
export function isPrefScope(value: unknown): value is PrefScope {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).length - (Object.hasOwn(value, PREF_ELSE) ? 1 : 0);
  return keys === 2 && typeof value.$by === 'string' && isPlainObject(value.$in);
}

/**
 * `value` with every scope in it that was stored as `{ $by, $of }`, the shape
 * before the values' key was renamed, in the current shape. The same value
 * when it holds none.
 */
export function upgradeScope(value: unknown): unknown {
  if (isPrefScope(value)) return mapMembers(value, upgradeScope);
  const old = isPlainObject(value) && Object.keys(value).length === 2 && typeof value.$by === 'string' && isPlainObject(value.$of);
  return old ? mapMembers({ $by: value.$by as string, $in: value.$of as Record<string, unknown> }, upgradeScope) : value;
}

/** The weights a plain selection amounts to: all of each selector's on the option chosen. */
export function selectionWeights(selection: PrefSelection): PrefWeights {
  return Object.fromEntries(Object.entries(selection).map(([path, option]) => [path, { [option]: 1 }]));
}

/** Whether `option` of the scope's selector is one a closed list leaves out, which shares the shared value. */
const shares = (scope: PrefScope, option: string, overridesOf: OverridesOf | undefined): boolean => {
  const overrides = overridesOf?.(scope.$by);
  return overrides !== undefined && !overrideOptions(overrides).includes(option);
};

/**
 * What one option of the scope's own selector reads: its own value where it
 * has one and may (an option a closed list leaves out never does); else,
 * for an option a closed list proposes a value for, that; else the shared
 * value. No option named reads the shared value too. Whatever is held
 * nothing for reads as `absent`.
 */
export function scopeOptionValue(scope: PrefScope, option: string | undefined, absent: unknown, overridesOf?: OverridesOf): unknown {
  if (option === undefined || shares(scope, option, overridesOf)) return restOr(scope, absent);
  if (Object.hasOwn(scope.$in, option)) return scope.$in[option];
  const overrides = overridesOf?.(scope.$by);
  return overrides && !named(overrides) && Object.hasOwn(overrides, option) ? overrides[option] : restOr(scope, absent);
}

/**
 * Every alternative of `stored` that weighs something under `weights`, each
 * with its share: the product of the weights on the way down to it. An option
 * the scope holds nothing for reads as `absent`, and a selector `weights`
 * leaves out reads the shared value, or nothing where there is none. Members come in the order `weights`
 * lists each selector's options.
 */
export function weighScope(stored: unknown, weights: PrefWeights, absent: unknown, overridesOf?: OverridesOf): PrefWeighted[] {
  const out: PrefWeighted[] = [];
  const walk = (value: unknown, weight: number): void => {
    if (!isPrefScope(value)) {
      out.push({ value, weight });
      return;
    }
    const given = weights[value.$by];
    if (given === undefined) {
      if (hasRest(value)) walk(value[PREF_ELSE], weight);
      return;
    }
    for (const [option, share] of Object.entries(given)) {
      if (share > 0) walk(scopeOptionValue(value, option, absent, overridesOf), weight * share);
    }
  };
  walk(stored, 1);
  return out;
}

/** The one value `selection` names. A selector it leaves out reads the shared value; an option the scope holds nothing for reads as `absent`. */
export function memberAt(stored: unknown, selection: PrefSelection, absent: unknown, overridesOf?: OverridesOf): unknown {
  let value = stored;
  while (isPrefScope(value)) value = scopeOptionValue(value, selection[value.$by], absent, overridesOf);
  return value;
}

/**
 * `stored` with the value `selection` names replaced by `next`: the one a
 * read under it comes from, except that an option that may keep a value of
 * its own has one from then on. A selector `selection` leaves out writes the
 * shared value. A value that is not split is replaced whole.
 */
export function writeMember(stored: unknown, selection: PrefSelection, next: unknown, overridesOf?: OverridesOf): unknown {
  if (!isPrefScope(stored)) return next;
  const option = selection[stored.$by];
  if (option === undefined || shares(stored, option, overridesOf)) return withRest(stored, writeMember(stored[PREF_ELSE], selection, next, overridesOf));
  return { ...stored, $in: { ...stored.$in, [option]: writeMember(stored.$in[option], selection, next, overridesOf) } };
}

/** `stored` without the values of options a closed list leaves out, which no read reaches, at any depth. The same value when there are none. */
export function dropUnlisted(stored: unknown, overridesOf: OverridesOf | undefined): unknown {
  if (!overridesOf || !isPrefScope(stored)) return stored;
  const overrides = overridesOf(stored.$by);
  const list = overrides && overrideOptions(overrides);
  const stale = list ? Object.keys(stored.$in).filter((option) => !list.includes(option)) : [];
  const kept = stale.length ? { ...stored, $in: Object.fromEntries(Object.entries(stored.$in).filter(([option]) => list!.includes(option))) } : stored;
  return mapMembers(kept, (inner) => dropUnlisted(inner, overridesOf));
}

/**
 * `stored` split by the selector at `by`, every option that may keep a value
 * of its own holding the value it had, and the shared value the same. The
 * same value where it is split by `by` already.
 * `order` is the pref's `scopes` selectors: a selector earlier in it sits
 * outside a later one, so one meaning has one stored form.
 */
export function splitScope(
  stored: unknown, by: string, options: readonly string[], order: readonly string[], overridesOf?: OverridesOf,
): unknown {
  const overrides = overridesOf?.(by);
  const own = overrides ? overrideOptions(overrides) : options;
  const across = (value: unknown): PrefScope => {
    const out: PrefScope = { $by: by, $in: Object.fromEntries(own.map((option) => [option, value])) };
    return options.every((option) => own.includes(option)) ? out : withRest(out, value);
  };
  if (!isPrefScope(stored)) return across(stored);
  if (stored.$by === by) return stored;
  if (order.indexOf(stored.$by) > order.indexOf(by)) return across(stored);
  return mapMembers(stored, (inner) => splitScope(inner, by, options, order, overridesOf));
}

/** `stored` no longer split by the selector at `by`: where it was, the value `selection` names stays. */
export function joinScope(stored: unknown, by: string, selection: PrefSelection, absent: unknown, overridesOf?: OverridesOf): unknown {
  if (!isPrefScope(stored)) return stored;
  if (stored.$by !== by) return mapMembers(stored, (inner) => joinScope(inner, by, selection, absent, overridesOf));
  return scopeOptionValue(stored, selection[by], absent, overridesOf);
}

function mapMembers(scope: PrefScope, fn: (member: unknown) => unknown): PrefScope {
  let out: Record<string, unknown> | undefined;
  for (const [option, value] of Object.entries(scope.$in)) {
    const next = fn(value);
    if (next !== value) (out ??= { ...scope.$in })[option] = next;
  }
  const mapped = out ? { ...scope, $in: out } : scope;
  if (!hasRest(scope)) return mapped;
  const rest = fn(scope[PREF_ELSE]);
  return rest === scope[PREF_ELSE] ? mapped : withRest(mapped, rest);
}

/** `stored` with each alternative mapped, at any depth. The same value when no value changed. */
export function mapScopeValues(stored: unknown, fn: (value: unknown) => unknown): unknown {
  return isPrefScope(stored) ? mapMembers(stored, (inner) => mapScopeValues(inner, fn)) : fn(stored);
}

/** The path of every selector `stored` is split by, outermost first. */
export function scopeSelectors(stored: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (value: unknown): void => {
    if (!isPrefScope(value)) return;
    out.add(value.$by);
    for (const inner of Object.values(value.$in)) walk(inner);
    if (hasRest(value)) walk(value[PREF_ELSE]);
  };
  walk(stored);
  return out;
}

/**
 * What a stored scope reads as: each value repaired, and left out a key that
 * is none of its selector's options or one a closed list leaves out.
 * `optionsOf` gives a selector's options, `null` for a selector that is no leaf, whose
 * keys are all kept. `undefined` when it is split by a selector not in
 * `allowed`, by one `optionsOf` has no options for, or by the same one twice
 * on the way to a value.
 */
export function repairScope(
  stored: unknown,
  allowed: readonly string[],
  optionsOf: (path: string) => readonly string[] | null | undefined,
  repairMember: (value: unknown) => unknown,
  overridesOf?: OverridesOf,
): unknown {
  const BAD = Symbol('bad');
  const walk = (value: unknown, met: readonly string[]): unknown => {
    if (!isPrefScope(value)) return repairMember(value);
    const options = allowed.includes(value.$by) && !met.includes(value.$by) ? optionsOf(value.$by) : undefined;
    if (options === undefined) return BAD;
    const inner = [...met, value.$by];
    const kept: [string, unknown][] = [];
    for (const option of options ?? Object.keys(value.$in)) {
      if (!Object.hasOwn(value.$in, option) || shares(value, option, overridesOf)) continue;
      const read = walk(value.$in[option], inner);
      if (read === BAD) return BAD;
      kept.push([option, read]);
    }
    const out: PrefScope = { $by: value.$by, $in: Object.fromEntries(kept) };
    if (!hasRest(value)) return out;
    const rest = walk(value[PREF_ELSE], inner);
    return rest === BAD ? BAD : withRest(out, rest);
  };
  const read = walk(stored, []);
  return read === BAD ? undefined : read;
}
