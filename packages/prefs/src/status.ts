// What a schema's conditions come to once nesting is counted: a node is drawn
// only while it and everything above it is shown, and takes input only while
// it and everything above it is enabled. Every surface that draws a schema
// asks here.

import type { PrefAction } from './action';
import type { PrefAlias } from './alias';
import { type PrefCondition, prefConditionReadsItem } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, setOwnPrefValue } from './helpers';
import { deferEntryConditions, type PrefConditionJudge } from './judge';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { PREF_ENTRY, PREF_STATUS, prefAliasStatus, prefStatusIn, prefStatusUnder, prefSectionPath, type PrefOwner, type PrefStatus } from './statusAt';
import type { PrefUnion } from './union';

export { PREF_CONDITION_FIELDS, prefJudge, prefReader, type PrefConditionField, type PrefConditionJudge, type PrefEntry } from './judge';
export { PREF_ENTRY, PREF_STATUS, prefStatusAt, prefStatusIn, prefStatusUnder, prefSectionPath, type PrefOwner, type PrefStatus, type PrefStatusAtOptions } from './statusAt';

const under = (prefix: string, key: string): string => (prefix === '' ? key : `${prefix}.${key}`);

/** A schema with its conditions applied. */
export interface PrefConditionsApplied<T> {
  /** The schema without the nodes that are not shown. The schema itself when
   *  that is all of it, and `null` when its root is not shown. */
  shown: T | null;
  /**
   * The value path of every leaf that is disabled, a field of an `object` or
   * a `union` leaf included (`'stroke.width'`), and under a {@link PrefGroup}
   * schema the path of every group that is, and of every section by
   * {@link prefSectionPath}. A `list`'s or a `map`'s item is
   * named once for every entry, with {@link PREF_ENTRY} as the entry's step:
   * `'phases.*'`, and `'phases.*.hold'` for a field of it.
   */
  disabled: ReadonlySet<string>;
  /**
   * With `keepHidden`, the path of everything `shown` holds that is not
   * shown, named as `disabled` names what is disabled. Empty without it,
   * since `shown` then holds none.
   */
  hidden: ReadonlySet<string>;
  /** The value path of every `action` leaf whose `activeIf` holds, named as `disabled` names what is disabled. */
  active: ReadonlySet<string>;
}

/** How {@link applyPrefConditions} treats what it would leave out. */
export interface PrefConditionsOptions {
  /** Keep a group or a section that leaves with nothing to draw. */
  keepEmpty?: boolean;
  /**
   * Keep every node whose `showIf` fails, and name it in `hidden`: for a
   * surface that edits the schema, where a node not drawn cannot be picked.
   */
  keepHidden?: boolean;
  /** The schema an alias's `of` names a leaf of. Default: the schema walked. */
  aliasOver?: PrefGroup | PrefSection;
  /** Says which conditions of `aliasOver` hold, where its values are not the ones `holds` reads. Default: `holds`. */
  aliasHolds?: PrefConditionJudge;
}

interface WalkOptions {
  keepEmpty: boolean;
  keepHidden: boolean;
  /** Asked inside the item of a list or a map met on the way, whose entries the walk does not have. */
  inItem: PrefConditionJudge;
  aliasOver?: PrefGroup | PrefSection;
  aliasHolds?: PrefConditionJudge;
  /** Whether `holds` gives `condition` its real answer, rather than one deferred to another pass. */
  answers: (condition: PrefCondition, holds: PrefConditionJudge) => boolean;
}

/** The walk over leaves and what is inside them, which the schema's pass and an entry's share. */
function leafWalk({ keepEmpty, keepHidden, inItem, aliasOver, aliasHolds, answers }: WalkOptions) {
  const disabled = new Set<string>();
  const hidden = new Set<string>();
  const active = new Set<string>();

  const leaf = (node: PrefLeaf, path: string, above: PrefStatus, holds: PrefConditionJudge, entry?: string): PrefLeaf | null => {
    const own = prefStatusUnder(above, node, holds);
    const status = node.kind === 'alias' && aliasOver ? prefAliasStatus(own, node as PrefAlias, aliasOver, aliasHolds ?? holds) : own;
    return status.shown || keepHidden ? inside(node, path, status, holds, above, entry) : null;
  };

  /** `node`, whose status is `status` in `above`, without what its own value hides: a field, or part of a list's or a
   *  map's item. `entry` is the path of the entry it sits in, if any. */
  const inside = (node: PrefLeaf, path: string, status: PrefStatus, holds: PrefConditionJudge, above = status, entry?: string): PrefLeaf => {
    if (!status.shown) hidden.add(path);
    if (!status.enabled) disabled.add(path);
    const { activeIf } = node as Partial<PrefAction>;
    if (node.kind === 'action' && activeIf !== undefined && answers(activeIf, holds) && holds(activeIf, 'activeIf')) active.add(path);
    const owner: PrefOwner = entry === undefined ? { node, status, above } : { node, status, above, entry };
    if (node.kind === 'object') {
      const children = members((node as PrefObject).children, path, owner, holds);
      return children === (node as PrefObject).children ? node : ({ ...node, children } as PrefLeaf);
    }
    if (node.kind === 'list' || node.kind === 'map') {
      const { item } = node as Partial<PrefList | PrefMap>;
      // A leaf an app's renderer draws under a built-in's kind may hold no item.
      if (item === undefined) return node;
      // An item is drawn with its entry, so its own `showIf` is not asked.
      const at = under(path, PREF_ENTRY);
      const entry = inside(item, at, prefStatusUnder(status, { enableIf: item.enableIf }, inItem), inItem, status, at);
      return entry === item ? node : ({ ...node, item: entry } as PrefLeaf);
    }
    if (node.kind !== 'union') return node;
    const { variants } = node as PrefUnion;
    let changed = false;
    const next: PrefUnion['variants'] = {};
    for (const [key, variant] of Object.entries(variants)) {
      const children = members(variant.children, path, owner, holds);
      changed ||= children !== variant.children;
      setOwnPrefValue(next, key, children === variant.children ? variant : { ...variant, children });
    }
    return changed ? ({ ...node, variants: next } as PrefLeaf) : node;
  };

  /** A section's members or an object leaf's children, held by `owner`. `prefix` is the object leaf's path, empty in a
   *  section schema, and `within` the path a section among them is named under (`prefSectionPath`). */
  const members = (
    held: PrefSection['members'], prefix: string, owner: PrefOwner, holds: PrefConditionJudge, within = prefix,
  ): PrefSection['members'] => {
    let changed = false;
    const out: PrefSection['members'] = {};
    for (const [key, child] of Object.entries(held)) {
      const at = under(prefix, key);
      const kept = isPrefLeaf(child)
        ? leaf(child, at, prefStatusIn(owner, at, holds), holds, owner.entry)
        : section(child, prefix, prefSectionPath(within, key), owner.status, holds, owner.entry);
      changed ||= kept !== child;
      if (kept !== null) setOwnPrefValue(out, key, kept);
    }
    return changed ? out : held;
  };

  const section = (
    node: PrefSection, prefix: string, path: string, above: PrefStatus, holds: PrefConditionJudge, entry?: string,
  ): PrefSection | null => {
    const status = prefStatusUnder(above, node, holds);
    if (!status.shown && !keepHidden) return null;
    if (!status.shown) hidden.add(path);
    if (!status.enabled) disabled.add(path);
    const kept = members(node.members, prefix, entry === undefined ? { node, status, above } : { node, status, above, entry }, holds, path);
    if (kept === node.members) return node;
    return Object.keys(kept).length === 0 && !keepEmpty ? null : { ...node, members: kept };
  };

  return { disabled, hidden, active, leaf, inside, members };
}

/**
 * `schema` as it is drawn while `holds` says which conditions hold. A node
 * whose `showIf` fails is dropped with everything under it, unless
 * `keepHidden`, and so is a group or a section that leaves with nothing to
 * draw, unless `keepEmpty`. A node
 * whose `enableIf` fails is disabled with everything under it. The item of
 * a `list` or a `map` is walked as its entries are drawn: its fields hide and
 * disable by their conditions, and its own `enableIf` disables every entry.
 * A condition there that reads the entry (`from: 'item'`) has no one answer
 * for every entry and is left holding: {@link applyPrefEntryConditions}
 * answers it for each.
 * An alias is shown only while it and the leaf it shows both are, and enabled
 * only while both are, with everything above that leaf counted. That leaf is
 * looked for in `aliasOver`, and its side is asked of `aliasHolds`.
 * Parts with nothing dropped come back as the objects they were.
 */
export function applyPrefConditions<T extends PrefGroup | PrefSection>(
  schema: T,
  holds: PrefConditionJudge,
  { keepEmpty = false, keepHidden = false, aliasOver, aliasHolds }: PrefConditionsOptions = {},
): PrefConditionsApplied<T> {
  const inItem = deferEntryConditions(holds);
  const answers = (condition: PrefCondition, by: PrefConditionJudge): boolean => by !== inItem || !prefConditionReadsItem(condition);
  const walk = leafWalk({ keepEmpty, keepHidden, inItem, aliasOver: aliasOver ?? schema, aliasHolds, answers });
  const { disabled, hidden, active } = walk;

  const group = (node: PrefGroup, path: string, above: PrefStatus): PrefGroup | null => {
    const status = prefStatusUnder(above, node, holds);
    if (!status.shown && !keepHidden) return null;
    if (!status.shown && path !== '') hidden.add(path);
    if (!status.enabled && path !== '') disabled.add(path);
    let changed = false;
    const children: PrefGroup['children'] = {};
    for (const [key, child] of Object.entries(node.children)) {
      const at = under(path, key);
      const kept = isPrefLeaf(child) ? walk.leaf(child, at, prefStatusIn({ node, status, above }, at, holds), holds) : group(child, at, status);
      changed ||= kept !== child;
      if (kept !== null) setOwnPrefValue(children, key, kept);
    }
    if (!changed) return node;
    return Object.keys(children).length === 0 && !keepEmpty && path !== '' ? null : { ...node, children };
  };

  if (!isPrefSection(schema)) return { shown: group(schema, '', PREF_STATUS) as T | null, disabled, hidden, active };
  const status = prefStatusUnder(PREF_STATUS, schema, holds);
  if (!status.shown && !keepHidden) return { shown: null, disabled, hidden, active };
  const kept = walk.members(schema.members, '', { node: schema, status, above: PREF_STATUS }, holds);
  return { shown: kept === schema.members ? schema : { ...schema, members: kept }, disabled, hidden, active };
}

/** One entry of a list or a map with the conditions that read it applied. */
export interface PrefEntryApplied {
  /** The item as this entry draws it: without the fields not shown, and the item itself when that is all of them. */
  item: PrefLeaf;
  /** The path of the entry, and of every field in it, that is disabled, named as {@link PrefConditionsApplied} names them. */
  disabled: ReadonlySet<string>;
  /** With `keepHidden`, the path of every field of the entry that is not shown. */
  hidden: ReadonlySet<string>;
  /** The path of every action in the entry whose `activeIf`, which reads the entry, holds. */
  active: ReadonlySet<string>;
}

const ALWAYS: PrefConditionJudge = () => true;

/**
 * The conditions {@link applyPrefConditions} leaves unanswered, answered for
 * one entry: `item`, as that pass left it, drawn for the entry at `path`
 * (`'phases.2'`) while `holds` says which conditions hold. `holds` reads the
 * entry: `prefJudge` given it. Only a condition that reads the entry is
 * asked, the rest being applied already, and one inside a list or a map
 * within the entry is left for that one's own entries.
 */
export function applyPrefEntryConditions(
  item: PrefLeaf,
  path: string,
  holds: PrefConditionJudge,
  { keepEmpty = false, keepHidden = false }: Pick<PrefConditionsOptions, 'keepEmpty' | 'keepHidden'> = {},
): PrefEntryApplied {
  const asked: PrefConditionJudge = (condition, field) => !prefConditionReadsItem(condition) || holds(condition, field);
  const answers = (condition: PrefCondition, by: PrefConditionJudge): boolean => by === asked && prefConditionReadsItem(condition);
  const walk = leafWalk({ keepEmpty, keepHidden, inItem: ALWAYS, answers });
  const status = prefStatusUnder(PREF_STATUS, { enableIf: item.enableIf }, asked);
  return { item: walk.inside(item, path, status, asked, PREF_STATUS, path), disabled: walk.disabled, hidden: walk.hidden, active: walk.active };
}
