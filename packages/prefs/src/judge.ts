// Who answers a condition: a judge, made from a way to read values.

import { prefConditionHolds, prefConditionReadsItem, type PrefCondition, type PrefConditionReader } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { prefShownReader } from './shown';

/** Which of a node's two conditions a {@link PrefConditionJudge} is asked about. */
export type PrefConditionField = 'showIf' | 'enableIf';

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

/** What `entry` holds at `path`, the empty path being the entry itself: its own value, else that part of the item's default. */
function entryValue({ item, value }: PrefEntry, path: string): unknown {
  if (path === '') return value !== undefined ? value : item.default;
  const held = prefValueAtPath(value, path);
  return held !== undefined ? held : prefValueAtPath(item.default, path);
}

/**
 * A judge over one set of values, read by path. A condition compares each
 * value as the control over its leaf in `schema` shows it
 * ({@link prefShownReader}), so `read` hands back what is stored. A test
 * that reads from the entry (`from: 'item'`) reads `entry`, and finds nothing
 * held where none is given.
 */
export function prefJudge(schema: PrefGroup | PrefSection, read: (path: string) => unknown, entry?: PrefEntry): PrefConditionJudge {
  const stored: PrefConditionReader = (path, from) => (from === 'item' ? entry && entryValue(entry, path) : read(path));
  const shown = prefShownReader(schema, stored, entry?.item);
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
 * holds there, else the default of the leaf at that path, or the part of a
 * leaf's default the rest of the path names.
 */
export function prefReader(schema: PrefGroup, values: unknown): (path: string) => unknown {
  return (path) => {
    const held = prefValueAtPath(values, path);
    if (held !== undefined) return held;
    const steps = path.split('.');
    let node: PrefGroup = schema;
    for (let i = 0; i < steps.length; i++) {
      if (!Object.hasOwn(node.children, steps[i]!)) return undefined;
      const child: PrefLeaf | PrefGroup = node.children[steps[i]!]!;
      if (!isPrefLeaf(child)) node = child;
      else return i === steps.length - 1 ? child.default : prefValueAtPath(child.default, steps.slice(i + 1).join('.'));
    }
    return undefined;
  };
}
