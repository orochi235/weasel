// What is wrong with a condition as one of a schema's: what a store warns of
// and a schema editor marks.

import { formOf, ORDERINGS, partsOf, type PrefConditionValue, type PrefTest } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefHoldsValue } from './helpers';
import { prefLeafHolding, prefLeafHoldingIn, prefSchemaHolding, UNSEEN } from './holding';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import { isBuiltinPref, type PrefEnum, type PrefLeaf, type PrefObject } from './schema';
import type { PrefUnion } from './union';

/** One thing wrong with a condition: it is not one, it reads a path no leaf
 *  holds a value at, it compares a leaf against a value it never holds — an
 *  enum against a string none of its options is being `option`, which a
 *  surface may take as a test that never matches — it
 *  never holds whatever the leaf does, as an `in` of no values, it is the
 *  `showIf` of a list's or a map's item, which is drawn with each entry, or
 *  it reads from the entry on a node that no list or map draws. */
export interface PrefConditionProblem {
  code: 'malformed' | 'no-leaf' | 'no-value' | 'value' | 'option' | 'never' | 'item-show' | 'no-item';
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

/** Where the node holding a condition sits, for what a condition alone does not say. */
export interface PrefConditionSite {
  /** The nearest list or map the node is inside an entry of: the one it is the `item` of, or one above it. */
  within?: PrefList | PrefMap;
  /** The condition is the `showIf` of that list's or map's `item` itself. */
  itemShowIf?: boolean;
}

const show = (value: unknown): string => (typeof value === 'string' ? `'${value}'` : String(value));

/** Why `leaf` never holds `value`; `undefined` when it may. */
function neverHolds(leaf: PrefLeaf, value: PrefConditionValue): string | undefined {
  if (value === null || !isBuiltinPref(leaf)) return undefined;
  switch (leaf.kind) {
    case 'number':
      return typeof value === 'number' ? undefined : 'it is a number';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'it is a boolean';
    case 'string':
    case 'color':
    case 'field':
      return typeof value === 'string' ? undefined : `it is a ${leaf.kind === 'string' ? 'string' : `${leaf.kind}, held as a string`}`;
    case 'enum': {
      const { options } = leaf as PrefEnum;
      if (options.some((option) => option.value === value)) return undefined;
      return `its options are ${options.map((option) => show(option.value)).join(', ')}`;
    }
    case 'object':
      return (leaf as PrefObject).fromScalar ? undefined : 'it is an object';
    default:
      return `it is a ${leaf.kind}`;
  }
}

type Schema = PrefGroup | PrefSection;

function testProblems(test: PrefTest, schema: Schema, site: PrefConditionSite, over: Schema | undefined): PrefConditionProblem[] {
  const { path } = test;
  if (test.from === 'item' && site.within === undefined) {
    return [{ code: 'no-item', path, problem: `"${path}" is read from an entry, and this is inside no list or map` }];
  }
  const found = leafProblems(test, schema, site, over);
  if (test.in?.length !== 0) return found;
  return [...found, { code: 'never', path, problem: `"${path}" is one of nothing, which never holds` }];
}

function leafProblems(test: PrefTest, schema: Schema, site: PrefConditionSite, over: Schema | undefined): PrefConditionProblem[] {
  const { path } = test;
  const inEntry = test.from === 'item';
  const held = inEntry ? prefLeafHoldingIn(site.within!.item, path) : prefLeafHolding(prefSchemaHolding(schema, path, over), path);
  if (held === undefined) return [{ code: 'no-leaf', path, problem: `no leaf holds a value at "${path}"${inEntry ? ' in the entry' : ''}` }];
  if (held === UNSEEN) return [];
  const { leaf } = held;
  const named = inEntry ? (path === '' ? 'the entry' : `the entry's "${path}"`) : `"${path}"`;
  if (!prefHoldsValue(leaf)) return [{ code: 'no-value', path, problem: `${named} is a${leaf.kind === 'separator' || leaf.kind === 'label' ? '' : 'n'} ${leaf.kind === 'actions' ? 'actions leaf' : leaf.kind}, which holds no value` }];
  const out: PrefConditionProblem[] = [];
  const compared = [test.is, test.isNot, ...(test.in ?? [])].filter((value) => value !== undefined);
  for (const value of compared) {
    const why = neverHolds(leaf, value);
    if (why === undefined) continue;
    const code = leaf.kind === 'enum' && typeof value === 'string' ? 'option' : 'value';
    out.push({ code, path, problem: `${named} never holds ${show(value)}: ${why}` });
  }
  const ordering = ORDERINGS.find((op) => test[op] !== undefined);
  if (ordering !== undefined && isBuiltinPref(leaf) && leaf.kind !== 'number') {
    out.push({ code: 'value', path, problem: `${named} is a${leaf.kind === 'object' || leaf.kind === 'enum' ? 'n' : ''} ${leaf.kind}, and "${ordering}" compares numbers` });
  }
  return out;
}

/**
 * What is wrong with `condition` as one of `schema`'s: every part of it that
 * is not a condition, every path it reads that no leaf holds a value at,
 * every comparison against a value the leaf's kind or options rule out, and
 * every `in` of no values.
 * `null` is never ruled out, and neither is anything under an app-defined
 * kind or inside a list, a map, or a paint, which the schema does not
 * describe. Takes `unknown`, since a schema read from JSON or built without
 * types may hold anything where a condition goes. `site` says where the
 * condition's node sits; without it the node is taken to be outside every
 * list and map. A path read from the entry is held to the `item` of
 * `site.within`, and is a problem where there is none. `over` is the schema
 * `schema` is drawn over: a path no leaf of `schema` holds is held to it,
 * and is a problem only where it holds none either.
 */
export function checkPrefCondition(
  condition: unknown,
  schema: PrefGroup | PrefSection,
  site: PrefConditionSite = {},
  over?: PrefGroup | PrefSection,
): PrefConditionProblem[] {
  if (site.itemShowIf && site.within) {
    const { kind } = site.within;
    const problem = `a ${kind}'s item is drawn with each entry and is never hidden: put the condition on the entry's fields, or on the ${kind}`;
    return [{ code: 'item-show', problem }, ...checkPrefCondition(condition, schema, { within: site.within }, over)];
  }
  const form = formOf(condition);
  if (form === undefined) {
    const shown = typeof condition === 'function' ? 'a function' : JSON.stringify(condition);
    return [{ code: 'malformed', problem: `not a condition: ${shown}` }];
  }
  if (form === 'test') return testProblems(condition as PrefTest, schema, site, over);
  return partsOf(condition, form).flatMap((part) => checkPrefCondition(part, schema, site, over));
}

type Conditioned = { showIf?: unknown; enableIf?: unknown };

/** {@link checkPrefCondition} over every `showIf` and `enableIf` in `schema`, in schema order, each held to `over` as well. */
export function checkPrefConditions(
  schema: PrefGroup | PrefSection,
  over?: PrefGroup | PrefSection,
): PrefSchemaConditionProblem[] {
  const out: PrefSchemaConditionProblem[] = [];
  const own = (node: Conditioned, at: string, within: PrefList | PrefMap | undefined, isItem = false): void => {
    for (const field of ['showIf', 'enableIf'] as const) {
      if (node[field] === undefined) continue;
      const site = { ...(within ? { within } : {}), ...(isItem && field === 'showIf' ? { itemShowIf: true } : {}) };
      for (const problem of checkPrefCondition(node[field], schema, site, over)) out.push({ ...problem, at, field });
    }
  };
  const under = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);
  const leaf = (node: PrefLeaf, at: string, within: PrefList | PrefMap | undefined, isItem = false): void => {
    own(node, at, within, isItem);
    if (node.kind === 'object') members((node as PrefObject).children, at, true, within);
    else if (node.kind === 'list' || node.kind === 'map') {
      const holder = node as PrefList | PrefMap;
      // A leaf an app's renderer draws under a built-in's kind may hold no item.
      if (holder.item !== undefined) leaf(holder.item, under(at, 'item'), holder, true);
    } else if (node.kind === 'union') {
      for (const [key, variant] of Object.entries((node as PrefUnion).variants)) leaf(variant, under(at, key), within);
    }
  };
  /** `nested`: inside an object leaf, where a key is relative to it; a section schema's own keys are whole. */
  const members = (held: PrefSection['members'], at: string, nested: boolean, within: PrefList | PrefMap | undefined): void => {
    for (const [key, child] of Object.entries(held)) {
      const here = nested ? under(at, key) : key;
      if (isPrefLeaf(child)) leaf(child, here, within);
      else {
        own(child, here, within);
        members(child.members, nested ? at : '', nested, within);
      }
    }
  };
  const group = (node: PrefGroup, at: string): void => {
    own(node, at, undefined);
    for (const [key, child] of Object.entries(node.children)) {
      if (isPrefLeaf(child)) leaf(child, under(at, key), undefined);
      else group(child, under(at, key));
    }
  };
  if (isPrefSection(schema)) {
    own(schema, '', undefined);
    members(schema.members, '', false, undefined);
  } else group(schema, '');
  return out;
}
