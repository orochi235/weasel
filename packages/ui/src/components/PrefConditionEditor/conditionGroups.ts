import type { PrefCondition, PrefTest } from '@weasel-js/prefs';

/** How many of a group's rows must hold: every one, at least one, not one, or fewer than every one. */
export type Quantifier = 'all' | 'any' | 'none' | 'notAll';

export const QUANTIFIER_LABEL: Record<Quantifier, string> = {
  all: 'All of',
  any: 'Any of',
  none: 'None of',
  notAll: 'Not all of',
};

/** What a group with no rows comes to, which is what its quantifier says of nothing. */
export const EMPTY_HOLDS: Record<Quantifier, boolean> = { all: true, any: false, none: true, notAll: false };

/** Rows under a quantifier: an `all` or an `any`, or the `not` of one. */
export interface ConditionGroup {
  quantifier: Quantifier;
  parts: readonly PrefCondition[];
}

/** A test, or the `not` of one. */
export interface TestRow {
  test: PrefTest;
  negated: boolean;
}

export const isTest = (condition: PrefCondition): condition is PrefTest =>
  !('all' in condition) && !('any' in condition) && !('not' in condition);

/** `condition` out of its `not`s, with whether they come to one: a `not` of a `not` is neither. */
function unwrap(condition: PrefCondition): { negated: boolean; inner: PrefCondition } {
  let negated = false;
  let inner = condition;
  while ('not' in inner) {
    negated = !negated;
    inner = inner.not;
  }
  return { negated, inner };
}

/** `condition` as a test or the `not` of one; `undefined` for a combinator. */
export function testRowOf(condition: PrefCondition): TestRow | undefined {
  const { negated, inner } = unwrap(condition);
  return isTest(inner) ? { test: inner, negated } : undefined;
}

/** A row as the condition it stands for. */
export const rowCondition = ({ test, negated }: TestRow): PrefCondition => (negated ? { not: test } : test);

/** `condition` as a group. The `not` of a test is none of that one test. */
export function groupOf(condition: PrefCondition): ConditionGroup {
  const { negated, inner } = unwrap(condition);
  if ('all' in inner) return { quantifier: negated ? 'notAll' : 'all', parts: inner.all };
  if ('any' in inner) return { quantifier: negated ? 'none' : 'any', parts: inner.any };
  return { quantifier: negated ? 'none' : 'all', parts: [inner] };
}

/** A group as the condition it stands for. */
export function groupCondition({ quantifier, parts }: ConditionGroup): PrefCondition {
  switch (quantifier) {
    case 'all': return { all: parts };
    case 'any': return { any: parts };
    case 'none': return { not: { any: parts } };
    case 'notAll': return { not: { all: parts } };
  }
}

/** The group a whole condition is drawn as: its own rows where it is one, and anything else as the one row of an `all`. */
export function rootGroup(value: PrefCondition | undefined): ConditionGroup {
  if (value === undefined) return { quantifier: 'all', parts: [] };
  const { inner } = unwrap(value);
  return isTest(inner) ? { quantifier: 'all', parts: [value] } : groupOf(value);
}

/** The root group as a condition: no rows is no condition, and one row under `all` is that row itself. */
export function rootCondition(group: ConditionGroup): PrefCondition | undefined {
  if (group.parts.length === 0) return undefined;
  if (group.parts.length === 1 && group.quantifier === 'all') return group.parts[0];
  return groupCondition(group);
}

/** The quantifier a group added inside one of `outer` starts at: the one that says something `outer` does not. */
export const nestedQuantifier = (outer: Quantifier): Quantifier => (outer === 'all' || outer === 'notAll' ? 'any' : 'all');
