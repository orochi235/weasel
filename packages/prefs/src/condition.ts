// A condition over other leaves' values, held as data so a schema carrying
// one still exports as a literal and survives a draft.

import { isPlainObject } from '@weasel-js/registry';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefHoldsValue, prefSectionLeaves } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import { isBuiltinPref, type PrefBoolean, type PrefEnum, type PrefLeaf, type PrefObject } from './schema';
import type { PrefUnion } from './union';

/** What a condition can compare a leaf's value against. `null` stands for
 *  nothing held: a missing value as well as a stored `null`. */
export type PrefConditionValue = string | number | boolean | null;

/**
 * One leaf's value, tested. `path` is the full path the value is read and
 * written at (`'windows.paging'`), a field of an `object` or `union` leaf
 * included (`'stroke.width'`, `'fill.type'`). With no operator it holds
 * while the value is truthy; with several, while all of them do, so
 * `{ path: 'count', atLeast: 1, below: 10 }` is a range.
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

const ORDERINGS = ['above', 'below', 'atLeast', 'atMost'] as const;
const TEST_KEYS: ReadonlySet<string> = new Set(['path', 'is', 'isNot', 'in', ...ORDERINGS]);

const isValue = (v: unknown): v is PrefConditionValue =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

type Form = 'all' | 'any' | 'not' | 'test';

/** Which form `value` is, judged on its own keys and not on what it holds. */
function formOf(value: unknown): Form | undefined {
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
function partsOf(condition: unknown, form: Form): readonly unknown[] {
  const held = condition as Record<string, unknown>;
  return form === 'test' ? [] : form === 'not' ? [held.not] : (held[form] as unknown[]);
}

/** Whether `value` is a well-formed condition, all the way down. */
export function isPrefCondition(value: unknown): value is PrefCondition {
  const form = formOf(value);
  return form !== undefined && partsOf(value, form).every(isPrefCondition);
}

const same = (held: unknown, value: PrefConditionValue): boolean => (value === null ? held == null : held === value);

function testHolds(test: PrefTest, held: unknown): boolean {
  const ops = Object.keys(test).filter((key) => key !== 'path' && test[key as keyof PrefTest] !== undefined);
  if (ops.length === 0) return Boolean(held);
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

/** One thing wrong with a condition: it is not one, it reads a path no leaf
 *  holds a value at, or it compares a leaf against a value it never holds. */
export interface PrefConditionProblem {
  code: 'malformed' | 'no-leaf' | 'no-value' | 'value';
  /** The path read, where the problem is with one. */
  path?: string;
  problem: string;
}

/** A {@link PrefConditionProblem} and the node whose condition has it. */
export interface PrefSchemaConditionProblem extends PrefConditionProblem {
  /**
   * Where the node sits: a key per step from the root, `''` for the root
   * itself. An object leaf's fields and sections, a union's variants, and a
   * list's or a map's `item` are steps too, so this is not always a path a
   * value is read at.
   */
  at: string;
  field: 'showIf' | 'enableIf';
}

/** A value the schema says nothing about: an entry of a list, a field of an app-defined kind. */
const UNSEEN = Symbol('unseen');

function amongFields(fields: [key: string, leaf: PrefLeaf][], path: string): PrefLeaf | typeof UNSEEN | undefined {
  const exact = fields.find(([key]) => key === path);
  if (exact) return exact[1];
  const outer = fields.find(([key]) => path.startsWith(`${key}.`));
  return outer && insideLeaf(outer[1], path.slice(outer[0].length + 1));
}

function insideLeaf(leaf: PrefLeaf, rest: string): PrefLeaf | typeof UNSEEN | undefined {
  if (leaf.kind === 'object') return amongFields(prefSectionLeaves((leaf as PrefObject).children), rest);
  if (leaf.kind === 'union') {
    const { tag, variants } = leaf as PrefUnion;
    if (rest === tag) {
      const options = Object.keys(variants).map((value) => ({ value, label: variants[value]!.name }));
      return { kind: 'enum', name: tag, description: '', default: undefined, options } as PrefEnum;
    }
    for (const variant of Object.values(variants)) {
      const found = amongFields(prefSectionLeaves(variant.children), rest);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return !isBuiltinPref(leaf) || leaf.kind === 'list' || leaf.kind === 'map' || leaf.kind === 'paint' ? UNSEEN : undefined;
}

/** The leaf describing the value at `path`, looking inside `object` and `union` leaves. */
function leafHolding(schema: PrefGroup | PrefSection, path: string): PrefLeaf | typeof UNSEEN | undefined {
  if (isPrefSection(schema)) return amongFields(prefSectionLeaves(schema.members), path);
  const steps = path.split('.');
  let node: PrefLeaf | PrefGroup = schema;
  for (let i = 0; i < steps.length; i++) {
    if (isPrefLeaf(node)) return insideLeaf(node, steps.slice(i).join('.'));
    if (!Object.hasOwn(node.children, steps[i]!)) return undefined;
    node = node.children[steps[i]!]!;
  }
  return isPrefLeaf(node) ? node : undefined;
}

const show = (value: unknown): string => (typeof value === 'string' ? `'${value}'` : String(value));

/** Why `leaf` never holds `value`; `undefined` when it may. */
function neverHolds(leaf: PrefLeaf, value: PrefConditionValue): string | undefined {
  if (value === null || !isBuiltinPref(leaf)) return undefined;
  switch (leaf.kind) {
    case 'number':
      return typeof value === 'number' ? undefined : 'it is a number';
    case 'boolean':
      return (leaf as PrefBoolean).encoding || typeof value === 'boolean' ? undefined : 'it is a boolean';
    case 'string':
    case 'color':
    case 'field':
      return typeof value === 'string' ? undefined : `it is a ${leaf.kind === 'string' ? 'string' : `${leaf.kind}, held as a string`}`;
    case 'enum': {
      const { encoding, options } = leaf as PrefEnum;
      if (encoding || options.some((option) => option.value === value)) return undefined;
      return `its options are ${options.map((option) => show(option.value)).join(', ')}`;
    }
    case 'object':
      return (leaf as PrefObject).fromScalar ? undefined : 'it is an object';
    default:
      return `it is a ${leaf.kind}`;
  }
}

function testProblems(test: PrefTest, schema: PrefGroup | PrefSection): PrefConditionProblem[] {
  const { path } = test;
  const leaf = leafHolding(schema, path);
  if (leaf === undefined) return [{ code: 'no-leaf', path, problem: `no leaf holds a value at "${path}"` }];
  if (leaf === UNSEEN) return [];
  if (!prefHoldsValue(leaf)) return [{ code: 'no-value', path, problem: `"${path}" is a${leaf.kind === 'separator' || leaf.kind === 'label' ? '' : 'n'} ${leaf.kind}, which holds no value` }];
  const out: PrefConditionProblem[] = [];
  const compared = [test.is, test.isNot, ...(test.in ?? [])].filter((value) => value !== undefined);
  for (const value of compared) {
    const why = neverHolds(leaf, value);
    if (why !== undefined) out.push({ code: 'value', path, problem: `"${path}" never holds ${show(value)}: ${why}` });
  }
  const ordering = ORDERINGS.find((op) => test[op] !== undefined);
  if (ordering !== undefined && isBuiltinPref(leaf) && leaf.kind !== 'number') {
    out.push({ code: 'value', path, problem: `"${path}" is a${leaf.kind === 'object' || leaf.kind === 'enum' ? 'n' : ''} ${leaf.kind}, and "${ordering}" compares numbers` });
  }
  return out;
}

/**
 * What is wrong with `condition` as one of `schema`'s: every part of it that
 * is not a condition, every path it reads that no leaf holds a value at, and
 * every comparison against a value the leaf's kind or options rule out.
 * `null` is never ruled out, and neither is anything under an app-defined
 * kind or inside a list, a map, or a paint, which the schema does not
 * describe. Takes `unknown`, since a schema read from JSON or built without
 * types may hold anything where a condition goes.
 */
export function checkPrefCondition(condition: unknown, schema: PrefGroup | PrefSection): PrefConditionProblem[] {
  const form = formOf(condition);
  if (form === undefined) {
    const shown = typeof condition === 'function' ? 'a function' : JSON.stringify(condition);
    return [{ code: 'malformed', problem: `not a condition: ${shown}` }];
  }
  if (form === 'test') return testProblems(condition as PrefTest, schema);
  return partsOf(condition, form).flatMap((part) => checkPrefCondition(part, schema));
}

type Conditioned = { showIf?: unknown; enableIf?: unknown };

/** {@link checkPrefCondition} over every `showIf` and `enableIf` in `schema`, in schema order. */
export function checkPrefConditions(schema: PrefGroup | PrefSection): PrefSchemaConditionProblem[] {
  const out: PrefSchemaConditionProblem[] = [];
  const own = (node: Conditioned, at: string): void => {
    for (const field of ['showIf', 'enableIf'] as const) {
      if (node[field] === undefined) continue;
      for (const problem of checkPrefCondition(node[field], schema)) out.push({ ...problem, at, field });
    }
  };
  const under = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);
  const leaf = (node: PrefLeaf, at: string): void => {
    own(node, at);
    if (node.kind === 'object') members((node as PrefObject).children, at, true);
    else if (node.kind === 'list' || node.kind === 'map') leaf((node as PrefList | PrefMap).item, under(at, 'item'));
    else if (node.kind === 'union') {
      for (const [key, variant] of Object.entries((node as PrefUnion).variants)) leaf(variant, under(at, key));
    }
  };
  /** `nested`: inside an object leaf, where a key is relative to it; a section schema's own keys are whole. */
  const members = (held: PrefSection['members'], at: string, nested: boolean): void => {
    for (const [key, child] of Object.entries(held)) {
      const here = nested ? under(at, key) : key;
      if (isPrefLeaf(child)) leaf(child, here);
      else {
        own(child, here);
        members(child.members, nested ? at : '', nested);
      }
    }
  };
  const group = (node: PrefGroup, at: string): void => {
    own(node, at);
    for (const [key, child] of Object.entries(node.children)) {
      if (isPrefLeaf(child)) leaf(child, under(at, key));
      else group(child, under(at, key));
    }
  };
  if (isPrefSection(schema)) {
    own(schema, '');
    members(schema.members, '', false);
  } else group(schema, '');
  return out;
}
