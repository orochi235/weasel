// The status of one node: whether it is drawn and whether it takes input,
// with everything above it counted.

import { prefAliasTarget, type PrefAlias } from './alias';
import { prefConditionPaths, type PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefLeafAt } from './helpers';
import { resolvePrefGroupConditions } from './groupConditions';
import { deferEntryConditions, type PrefConditionJudge } from './judge';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import type { PrefUnion } from './union';

/** Whether a node is drawn and whether it takes input, with what is above it counted. */
export interface PrefStatus {
  shown: boolean;
  enabled: boolean;
}

/** The step that stands for any entry of a `list` or a `map` in a path: `'phases.*.hold'` answers for that field of
 *  each, by every condition that comes to the same for every entry. */
export const PREF_ENTRY = '*';

/**
 * The path a section is named by where a set of paths names it, such as `applyPrefConditions`'s `disabled`: `at`, the
 * path of what holds it, then its key marked so no value path can be the same. `at` is the path of the `object`
 * leaf holding it, empty at a section root, or the path of the section holding it: `'stroke.#edge'`,
 * `'#look.#more'`.
 */
export const prefSectionPath = (at: string, key: string): string => (at === '' ? `#${key}` : `${at}.#${key}`);

/** The status a schema's root sits in. */
export const ROOT_PREF_STATUS: PrefStatus = Object.freeze({ shown: true, enabled: true });

/** The status of `node`, which sits directly under something whose status is `above`. */
export function prefStatusUnder(
  above: PrefStatus,
  node: { showIf?: PrefCondition; enableIf?: PrefCondition },
  holds: PrefConditionJudge,
): PrefStatus {
  const shown = above.shown && (node.showIf === undefined || holds(node.showIf, 'showIf'));
  const enabled = above.enabled && (node.enableIf === undefined || holds(node.enableIf, 'enableIf'));
  return shown === above.shown && enabled === above.enabled ? above : { shown, enabled };
}

/** What holds a node: a group, a section, or a leaf with fields, with its own status and the status it sits in. */
export interface PrefOwner {
  node: { showIf?: PrefCondition; enableIf?: PrefCondition };
  status: PrefStatus;
  above: PrefStatus;
  /** The path of the list's or the map's entry the owner sits in (`'phases.2'`), under which a condition that reads
   *  the entry (`from: 'item'`) names its paths. Unset outside an entry, or where it has no one path. */
  entry?: string;
  /** An owner whose `enableIf` reads a field inside this owner's leaf, and so spares that leaf only on the way to the
   *  field: everything else in it stays disabled by that owner's condition. */
  switchOf?: PrefOwner;
}

/** An owner, with `entry` and `switchOf` set only where they are given. */
export function prefOwner(node: PrefOwner['node'], status: PrefStatus, above: PrefStatus, entry?: string, switchOf?: PrefOwner): PrefOwner {
  return { node, status, above, ...(entry === undefined ? {} : { entry }), ...(switchOf === undefined ? {} : { switchOf }) };
}

/** Whether `owner`'s `enableIf` reads the value at `path`: `'at'` that value, `'inside'` a field of it. */
function switchReads({ node, entry }: PrefOwner, path: string): 'at' | 'inside' | undefined {
  if (node.enableIf === undefined) return undefined;
  const paths = prefConditionPaths(node.enableIf);
  if (entry !== undefined) paths.push(...prefConditionPaths(node.enableIf, 'item').map((p) => `${entry}.${p}`));
  if (paths.includes(path)) return 'at';
  return paths.some((p) => p.startsWith(`${path}.`)) ? 'inside' : undefined;
}

/** Whether `owner` disables what is in it by its own `enableIf`, and so has a switch to spare. */
const disablesOwn = ({ node, status, above }: PrefOwner): boolean => !status.enabled && above.enabled && node.enableIf !== undefined;

/**
 * The owner whose switch is a field inside the leaf at `path`, directly in `owner`, which is to be the `switchOf` of
 * that leaf's own owner: `owner`, or the one `owner` carries, where its condition reads a field of that leaf.
 */
export function prefSwitchOf(owner: PrefOwner, path: string): PrefOwner | undefined {
  if (owner.switchOf !== undefined && switchReads(owner.switchOf, path) === 'inside') return owner.switchOf;
  return disablesOwn(owner) && switchReads(owner, path) === 'inside' ? owner : undefined;
}

/**
 * The status a leaf at `path` directly in `owner` sits in: the owner's, except
 * that the owner's own `enableIf` does not disable a leaf it reads, or one
 * holding a field it reads. That leaf is the owner's switch, or the way to it,
 * and disabled by its own condition it could never be turned back on. A test
 * that reads the entry reads the leaf at its path under `owner.entry`. Inside
 * a leaf spared only on the way to its switch (`owner.switchOf`), everything
 * but the way stays disabled.
 */
export function prefStatusIn(owner: PrefOwner, path: string, holds: PrefConditionJudge): PrefStatus {
  const own = sparedIn(owner, path, holds);
  const { switchOf } = owner;
  if (switchOf === undefined || !own.enabled || switchReads(switchOf, path) !== undefined) return own;
  return { shown: own.shown, enabled: false };
}

function sparedIn(owner: PrefOwner, path: string, holds: PrefConditionJudge): PrefStatus {
  if (!disablesOwn(owner) || switchReads(owner, path) === undefined) return owner.status;
  return prefStatusUnder(owner.above, { showIf: owner.node.showIf }, holds);
}

const under = (prefix: string, key: string): string => (prefix === '' ? key : `${prefix}.${key}`);

/**
 * The keys of the variants `holds` says the union at `path` holds, every key where it names none (a judge over
 * several values that differ, or a path through any entry). Inside the entry at `entry`, its tag is read from the
 * entry.
 */
export function prefHeldVariants(union: PrefUnion, path: string, holds: PrefConditionJudge, entry?: string): string[] {
  const keys = Object.keys(union.variants);
  const inEntry = entry === undefined ? undefined : path === entry ? '' : path.startsWith(`${entry}.`) ? path.slice(entry.length + 1) : undefined;
  const test = (key: string): PrefCondition => (inEntry === undefined
    ? { path: under(path, union.tag), is: key }
    : { from: 'item', path: under(inEntry, union.tag), is: key });
  const held = keys.filter((key) => holds(test(key), 'showIf'));
  return held.length === 0 ? keys : held;
}

/** The status of the field at `rest` among the members of `owner`, whose leaves' paths start at `prefix`, or `undefined` when none is there.
 *  A member keyed by all of `rest` answers ahead of one whose key only begins it. */
function statusAmong(
  held: PrefSection['members'], prefix: string, rest: string, owner: PrefOwner, holds: PrefConditionJudge, narrow: Narrow,
): PrefStatus | undefined {
  return statusMatching(held, prefix, rest, owner, holds, narrow, true) ?? statusMatching(held, prefix, rest, owner, holds, narrow, false);
}

/** A leaf's status by its own conditions, narrowed as the walk narrows an alias by the leaf it shows. */
type Narrow = (leaf: PrefLeaf, own: PrefStatus) => PrefStatus;
const UNNARROWED: Narrow = (_leaf, own) => own;

function statusMatching(
  held: PrefSection['members'], prefix: string, rest: string, owner: PrefOwner, holds: PrefConditionJudge, narrow: Narrow, exact: boolean,
): PrefStatus | undefined {
  for (const [key, child] of Object.entries(held)) {
    if (!isPrefLeaf(child)) {
      const found = statusMatching(child.members, prefix, rest, prefOwner(child, prefStatusUnder(owner.status, child, holds), owner.status, owner.entry, owner.switchOf), holds, narrow, exact);
      if (found) return found;
      continue;
    }
    if (exact ? rest !== key : !rest.startsWith(`${key}.`)) continue;
    const path = under(prefix, key);
    const sits = prefStatusIn(owner, path, holds);
    const status = narrow(child, prefStatusUnder(sits, child, holds));
    const inner = prefOwner(child, status, sits, owner.entry, prefSwitchOf(owner, path));
    return rest === key ? status : statusInside(child, path, rest.slice(key.length + 1), inner, holds, narrow);
  }
  return undefined;
}

/** The status at `rest` inside `owner`'s leaf, at `path`: that of a field, or the leaf's where `rest` names none. */
function statusInside(leaf: PrefLeaf, path: string, rest: string, owner: PrefOwner, holds: PrefConditionJudge, narrow: Narrow): PrefStatus {
  const { status } = owner;
  if (leaf.kind === 'object') return statusAmong((leaf as PrefObject).children, path, rest, owner, holds, narrow) ?? status;
  if (leaf.kind === 'list' || leaf.kind === 'map') {
    const { item } = leaf as Partial<PrefList | PrefMap>;
    if (item === undefined) return status;
    const inItem = deferEntryConditions(holds);
    const entry = prefStatusUnder(status, { enableIf: item.enableIf }, inItem);
    const dot = rest.indexOf('.');
    if (dot < 0) return entry;
    const at = `${path}.${rest.slice(0, dot)}`;
    return statusInside(item, at, rest.slice(dot + 1), { node: { enableIf: item.enableIf }, status: entry, above: status }, inItem, narrow);
  }
  if (leaf.kind !== 'union') return status;
  const held = prefHeldVariants(leaf as PrefUnion, path, holds);
  const heldFirst = Object.entries((leaf as PrefUnion).variants).sort(([a], [b]) => Number(!held.includes(a)) - Number(!held.includes(b)));
  for (const [, variant] of heldFirst) {
    const found = statusAmong(variant.children, path, rest, owner, holds, narrow);
    if (found) return found;
  }
  return status;
}

function statusAt(schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge, narrow = UNNARROWED): PrefStatus {
  let owner: PrefOwner = { node: schema, status: prefStatusUnder(ROOT_PREF_STATUS, schema, holds), above: ROOT_PREF_STATUS };
  if (path === '') return owner.status;
  if (isPrefSection(schema)) return statusAmong(schema.members, '', path, owner, holds, narrow) ?? owner.status;
  let node: PrefGroup = schema;
  const steps = path.split('.');
  for (let i = 0; i < steps.length; i++) {
    if (!Object.hasOwn(node.children, steps[i]!)) return owner.status;
    const child: PrefLeaf | PrefGroup = node.children[steps[i]!]!;
    const at = steps.slice(0, i + 1).join('.');
    const sits = isPrefLeaf(child) ? prefStatusIn(owner, at, holds) : owner.status;
    const status = prefStatusUnder(sits, child, holds);
    owner = prefOwner(child, isPrefLeaf(child) ? narrow(child, status) : status, sits, undefined, isPrefLeaf(child) ? prefSwitchOf(owner, at) : undefined);
    if (isPrefLeaf(child)) return i === steps.length - 1 ? owner.status : statusInside(child, at, steps.slice(i + 1).join('.'), owner, holds, narrow);
    node = child;
  }
  return owner.status;
}

/** `own`, an alias's status by its own conditions, narrowed by that of the leaf it shows in `over`, as `holds` judges `over`. */
export function prefAliasStatus(own: PrefStatus, alias: PrefAlias, overGiven: PrefGroup | PrefSection, holds: PrefConditionJudge): PrefStatus {
  const over = resolvePrefGroupConditions(overGiven);
  const target = prefAliasTarget(alias, (path) => prefLeafAt(over, path));
  if (target === undefined) return own;
  const theirs = statusAt(over, target.path, holds);
  const shown = own.shown && theirs.shown;
  const enabled = own.enabled && theirs.enabled;
  return shown === own.shown && enabled === own.enabled ? own : { shown, enabled };
}

/** What {@link prefStatusAt} is told beyond the schema. */
export interface PrefStatusAtOptions {
  /** The schema an alias's `of` names a leaf of. Default: the schema asked. */
  aliasOver?: PrefGroup | PrefSection;
  /** Says which conditions of `aliasOver` hold, where its values are not the ones `holds` reads. Default: `holds`. */
  aliasHolds?: PrefConditionJudge;
}

/**
 * The status of the node at `path`: a group, a leaf, a field of an `object`
 * or a `union` leaf, or an entry of a `list` or a `map`, whose step may be
 * any key. Under a {@link PrefSection} schema a leaf's key is its whole
 * path. A path that runs past the schema answers for the last node it
 * reaches. An alias answers for itself and for the leaf it shows, as
 * `applyPrefConditions` has it. Inside an entry, a condition that reads the
 * entry (`from: 'item'`) is not asked and counts as holding, there being no
 * entry here to read: `applyPrefEntryConditions` answers it.
 */
export function prefStatusAt(
  schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge, { aliasOver, aliasHolds }: PrefStatusAtOptions = {},
): PrefStatus {
  schema = resolvePrefGroupConditions(schema);
  const over = aliasOver ?? schema;
  const narrow: Narrow = (leaf, own) => (leaf.kind === 'alias' ? prefAliasStatus(own, leaf as PrefAlias, over, aliasHolds ?? holds) : own);
  return statusAt(schema, path, holds, narrow);
}
