// Who answers a condition: a judge, made from a way to read values.

import { prefConditionHolds, prefConditionReadsItem, type PrefCondition, type PrefConditionReader } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefHoldsValue, prefSectionLeaves, prefValueAt } from './helpers';
import { prefLeavesHoldingIn, prefSchemaHolding, UNSEEN, UNSEEN_LEAF } from './holding';
import { prefObjectBase } from './object';
import { prefValueAbsent } from './leafValue';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { setOwn } from '@weasel-js/registry';
import { isPrefScope, prefScopeValue } from './scope';
import { prefOverridesLookup, prefScopedDefault, prefScopesOf } from './scopeSpec';
import { prefShownReader, prefVariantField } from './shown';

/** Every field a schema node holds a {@link PrefCondition} in. `activeIf` is an action leaf's alone. */
export const PREF_CONDITION_FIELDS = ['showIf', 'enableIf', 'activeIf'] as const;

/** Which of a node's conditions a {@link PrefConditionJudge} is asked about. */
export type PrefConditionField = (typeof PREF_CONDITION_FIELDS)[number];

/**
 * Says whether one condition holds. {@link prefJudge} makes one from a value
 * reader; a surface drawing several values at once writes its own, to say
 * what a condition that holds for some and not for others comes to.
 */
export type PrefConditionJudge = (condition: PrefCondition, field: PrefConditionField) => boolean;

/** One entry of a list or a map: the `item` leaf describing it, and what it holds. */
export interface PrefEntry {
  item: PrefLeaf;
  value: unknown;
}

/** What `entry` holds at `path`, the empty path being the entry itself: its own value, else that part of the item's
 *  default, a field read as {@link fieldValue} reads it. */
function entryValue({ item, value }: PrefEntry, path: string): unknown {
  if (path === '') return prefValueAbsent(item, value) ? item.default : value;
  return fieldValue(item, prefValueAbsent(item, value) ? item.default : value, path);
}

/**
 * A judge over one set of values, read by path. A condition compares each
 * value as the control over its leaf in `schema` shows it
 * ({@link prefShownReader}), so `read` hands back what is stored. A test
 * that reads from the entry (`from: 'item'`) reads `entry`, and finds nothing
 * held where none is given. `over` is the schema `schema` is drawn over: a
 * path no leaf of `schema` holds is compared as the leaf of `over` there
 * shows it.
 */
export function prefJudge(
  schema: PrefGroup | PrefSection, read: (path: string) => unknown, entry?: PrefEntry, over?: PrefGroup | PrefSection,
): PrefConditionJudge {
  const stored: PrefConditionReader = (path, from) => (from === 'item' ? entry && entryValue(entry, path) : read(path));
  const shown = prefShownReader(schema, stored, entry?.item, over);
  return (condition) => prefConditionHolds(condition, shown);
}

/**
 * `holds` for every condition but one that reads the entry, which is left
 * unanswered, which is to say holding: what a walk with no entry in hand
 * asks inside the item of a list or a map.
 */
export function deferEntryConditions(holds: PrefConditionJudge): PrefConditionJudge {
  return (condition, field) => prefConditionReadsItem(condition) || holds(condition, field);
}

/**
 * Reads a value by path the way a form over `schema` shows it: what `values`
 * holds there, else what the leaf at that path holds with nothing stored (its
 * `auto.value` where it starts auto, its `defaultScope` where it has one, else
 * its `default`), or the part of that the rest of the path names, as
 * {@link fieldValue} reads it. A split
 * value reads as the one its selectors' options, read the same way, name.
 * `over` is the schema `schema` is drawn over: a path no leaf of `schema`
 * holds is read as a reader over `over` reads it.
 */
export function prefReader(schema: PrefGroup | PrefSection, values: unknown, over?: PrefGroup | PrefSection): (path: string) => unknown {
  const beyond = over && prefReader(over, values);
  // A selector split by the leaf it selects for reads as nothing held while that leaf is being read.
  const reading = new Set<string>();
  const read = (path: string): unknown => {
    if (reading.has(path)) return undefined;
    reading.add(path);
    try {
      return readAt(path);
    } finally {
      reading.delete(path);
    }
  };
  const readAt = (path: string): unknown => {
    if (beyond && prefSchemaHolding(schema, path, over) === over) return beyond(path);
    const found = leafHolding(schema, path);
    if (found === undefined) return prefValueAt(values, path);
    const [key, leaf] = found;
    const value = shownValue(leaf, prefValueAt(values, key), read);
    if (key === path) return value;
    const rest = path.slice(key.length + 1);
    return fieldValue(leaf, value, rest);
  };
  return read;
}

/** The leaf of `schema` at `path`, or the one whose value `path` names a part of, with that leaf's own path. */
function leafHolding(schema: PrefGroup | PrefSection, path: string): [key: string, leaf: PrefLeaf] | undefined {
  if (isPrefSection(schema)) {
    const leaves = prefSectionLeaves(schema.members);
    return leaves.find(([key]) => key === path) ?? leaves.find(([key]) => path.startsWith(`${key}.`));
  }
  const steps = path.split('.');
  let node: PrefGroup = schema;
  for (let i = 0; i < steps.length; i++) {
    if (!Object.hasOwn(node.children, steps[i]!)) return undefined;
    const child: PrefLeaf | PrefGroup = node.children[steps[i]!]!;
    if (isPrefLeaf(child)) return [steps.slice(0, i + 1).join('.'), child];
    node = child;
  }
  return undefined;
}

/**
 * The field at `rest` of `value`, which `leaf` shows, as a form draws it: where the object omits it, the default of
 * the leaf describing it, and absent where none does. An object leaf's scalar is read as the object it lifts to.
 */
function fieldValue(leaf: PrefLeaf, value: unknown, rest: string): unknown {
  if (leaf.kind === 'list' || leaf.kind === 'map') return entryAt(leaf as Partial<PrefList | PrefMap>, value, rest);
  const held = leaf.kind === 'object' ? prefObjectBase(leaf as PrefObject, value) : value;
  const field = prefValueAt(held, rest);
  if (field !== undefined) return field;
  const found = prefLeavesHoldingIn(leaf, rest);
  if (found === undefined || found === UNSEEN) return undefined;
  const describes = found.find((each) => (each.variants ?? []).every((v) => prefVariantField(v.at === '' ? held : prefValueAt(held, v.at), v.tag) === v.key));
  return describes === undefined || describes.leaf === UNSEEN_LEAF ? undefined : unsetValue(describes.leaf);
}

/** What the entry `rest` begins with holds at the rest of it, as {@link entryValue} reads it; absent where there is no such entry. */
function entryAt({ item }: Partial<PrefList | PrefMap>, value: unknown, rest: string): unknown {
  const dot = rest.indexOf('.');
  const key = dot < 0 ? rest : rest.slice(0, dot);
  if (item === undefined || typeof value !== 'object' || value === null || !Object.hasOwn(value, key)) return prefValueAt(value, rest);
  return entryValue({ item, value: (value as Record<string, unknown>)[key] }, dot < 0 ? '' : rest.slice(dot + 1));
}

/** What `leaf`, holding `held`, reads as: with nothing held, what it holds unset; a split value, the option `read` selects. */
function shownValue(leaf: PrefLeaf, held: unknown, read: (path: string) => unknown): unknown {
  const value = prefValueAbsent(leaf, held) ? unsetValue(leaf) : held;
  if (!isPrefScope(value)) return value;
  const selection: Record<string, string> = {};
  for (const { selector } of prefScopesOf(leaf)) {
    const option = read(selector);
    if (option !== undefined && option !== null) setOwn(selection, selector, String(option));
  }
  return prefScopeValue(value, selection, leaf.default, prefOverridesLookup(leaf));
}

function unsetValue(leaf: PrefLeaf): unknown {
  if (prefHoldsValue(leaf) && typeof leaf.auto === 'object' && leaf.auto !== null && leaf.auto.on === true) return leaf.auto.value;
  return prefScopedDefault(leaf) ?? leaf.default;
}
