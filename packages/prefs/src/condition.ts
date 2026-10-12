// A condition over other leaves' values, held as data so a schema carrying
// one still exports as a literal and survives a draft.

import { isPlainObject } from '@weasel-js/registry';

/** What a condition can compare a leaf's value against. `null` stands for
 *  nothing held: a missing value as well as a stored `null`. */
export type PrefConditionValue = string | number | boolean | null;

/**
 * One leaf's value, tested. `path` is the full path the value is read and
 * written at (`'windows.paging'`), a field of an `object` or `union` leaf
 * included (`'stroke.width'`, `'fill.type'`). The value compared is the one
 * the leaf's control shows, where an `encoding` stores another. With
 * several operators it holds while all of them do, so
 * `{ path: 'count', atLeast: 1, below: 10 }` is a range.
 *
 * With no operator it holds while the value is set, which by kind is:
 * a `boolean` that is on; a `number` other than 0; a `string`, a `color`, a
 * `field`, or an `enum`'s option that is not the empty string; a `paint`
 * that is not `null`; a `list` with an entry; a `map` with a key; an
 * `object` or a `union` holding a field. Nothing held is never set, and the
 * value of an app-defined kind is set by whichever of those its shape is,
 * else while it is truthy.
 */
export interface PrefTest {
  path: string;
  is?: PrefConditionValue;
  isNot?: PrefConditionValue;
  /** Holds while the value is any of these. */
  in?: readonly PrefConditionValue[];
  /** The ordering operators hold only for a number. */
  above?: number;
  below?: number;
  atLeast?: number;
  atMost?: number;
}

/** A condition a schema node holds in `showIf` or `enableIf`. An empty `all`
 *  holds and an empty `any` does not. */
export type PrefCondition =
  | PrefTest
  | { all: readonly PrefCondition[] }
  | { any: readonly PrefCondition[] }
  | { not: PrefCondition };

export const ORDERINGS = ['above', 'below', 'atLeast', 'atMost'] as const;
const TEST_KEYS: ReadonlySet<string> = new Set(['path', 'is', 'isNot', 'in', ...ORDERINGS]);

const isValue = (v: unknown): v is PrefConditionValue =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

export type Form = 'all' | 'any' | 'not' | 'test';

/** Which form `value` is, judged on its own keys and not on what it holds. */
export function formOf(value: unknown): Form | undefined {
  if (!isPlainObject(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length === 1 && (keys[0] === 'all' || keys[0] === 'any')) return Array.isArray(value[keys[0]]) ? keys[0] : undefined;
  if (keys.length === 1 && keys[0] === 'not') return 'not';
  if (typeof value.path !== 'string' || !keys.every((key) => TEST_KEYS.has(key))) return undefined;
  if (value.is !== undefined && !isValue(value.is)) return undefined;
  if (value.isNot !== undefined && !isValue(value.isNot)) return undefined;
  if (value.in !== undefined && !(Array.isArray(value.in) && value.in.every(isValue))) return undefined;
  return ORDERINGS.every((op) => value[op] === undefined || typeof value[op] === 'number') ? 'test' : undefined;
}

/** The conditions directly inside a combinator; none for a test. */
export function partsOf(condition: unknown, form: Form): readonly unknown[] {
  const held = condition as Record<string, unknown>;
  return form === 'test' ? [] : form === 'not' ? [held.not] : (held[form] as unknown[]);
}

/** Whether `value` is a well-formed condition, all the way down. */
export function isPrefCondition(value: unknown): value is PrefCondition {
  const form = formOf(value);
  return form !== undefined && partsOf(value, form).every(isPrefCondition);
}

const same = (held: unknown, value: PrefConditionValue): boolean => (value === null ? held == null : held === value);

function isSet(held: unknown): boolean {
  if (Array.isArray(held)) return held.length > 0;
  if (isPlainObject(held)) return Object.keys(held).length > 0;
  return Boolean(held);
}

function testHolds(test: PrefTest, held: unknown): boolean {
  const ops = Object.keys(test).filter((key) => key !== 'path' && test[key as keyof PrefTest] !== undefined);
  if (ops.length === 0) return isSet(held);
  if (test.is !== undefined && !same(held, test.is)) return false;
  if (test.isNot !== undefined && same(held, test.isNot)) return false;
  if (test.in !== undefined && !test.in.some((value) => same(held, value))) return false;
  if (!ORDERINGS.some((op) => test[op] !== undefined)) return true;
  if (typeof held !== 'number') return false;
  return (
    (test.above === undefined || held > test.above) &&
    (test.below === undefined || held < test.below) &&
    (test.atLeast === undefined || held >= test.atLeast) &&
    (test.atMost === undefined || held <= test.atMost)
  );
}

/** Whether `condition` holds, given the value `read` finds at each path it names. */
export function prefConditionHolds(condition: PrefCondition, read: (path: string) => unknown): boolean {
  if ('all' in condition) return condition.all.every((part) => prefConditionHolds(part, read));
  if ('any' in condition) return condition.any.some((part) => prefConditionHolds(part, read));
  if ('not' in condition) return !prefConditionHolds(condition.not, read);
  return testHolds(condition, read(condition.path));
}

/** Whether a node is drawn: its `showIf` holds, or it has none. A node
 *  answers for itself only; one inside a group that is not shown is not
 *  drawn either. */
export function prefIsShown(node: { showIf?: PrefCondition }, read: (path: string) => unknown): boolean {
  return node.showIf === undefined || prefConditionHolds(node.showIf, read);
}

/** Whether a node's controls take input: its `enableIf` holds, or it has
 *  none. As {@link prefIsShown}, a node answers for itself only. */
export function prefIsEnabled(node: { enableIf?: PrefCondition }, read: (path: string) => unknown): boolean {
  return node.enableIf === undefined || prefConditionHolds(node.enableIf, read);
}

/** Every path `condition` reads, once each, in the order met. */
export function prefConditionPaths(condition: PrefCondition): string[] {
  const out = new Set<string>();
  const walk = (c: PrefCondition): void => {
    if ('all' in c) c.all.forEach(walk);
    else if ('any' in c) c.any.forEach(walk);
    else if ('not' in c) walk(c.not);
    else out.add(c.path);
  };
  walk(condition);
  return [...out];
}

/**
 * `condition` with every path it reads put through `move`, for following a
 * key that was renamed or a leaf that moved. A condition none of whose paths
 * change comes back as the object it was given, and so does each part of one.
 */
export function mapPrefConditionPaths(condition: PrefCondition, move: (path: string) => string): PrefCondition {
  const each = (parts: readonly PrefCondition[]): readonly PrefCondition[] => {
    const next = parts.map((part) => mapPrefConditionPaths(part, move));
    return next.every((part, i) => part === parts[i]) ? parts : next;
  };
  if ('all' in condition) {
    const all = each(condition.all);
    return all === condition.all ? condition : { all };
  }
  if ('any' in condition) {
    const any = each(condition.any);
    return any === condition.any ? condition : { any };
  }
  if ('not' in condition) {
    const not = mapPrefConditionPaths(condition.not, move);
    return not === condition.not ? condition : { not };
  }
  const path = move(condition.path);
  return path === condition.path ? condition : { ...condition, path };
}
