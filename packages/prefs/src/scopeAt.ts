// The scope of one node: whether it is drawn and whether it takes input,
// with everything above it counted.

import { prefAliasTarget, type PrefAlias } from './alias';
import { prefConditionPaths, type PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefLeafAt } from './helpers';
import { deferEntryConditions, type PrefConditionJudge } from './judge';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import type { PrefUnion } from './union';

/** Whether a node is drawn and whether it takes input, with what is above it counted. */
export interface PrefScope {
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

/** The scope a schema's root sits in. */
export const PREF_SCOPE: PrefScope = Object.freeze({ shown: true, enabled: true });

/** The scope of `node`, which sits directly under something whose scope is `above`. */
export function prefScopeUnder(
  above: PrefScope,
  node: { showIf?: PrefCondition; enableIf?: PrefCondition },
  holds: PrefConditionJudge,
): PrefScope {
  const shown = above.shown && (node.showIf === undefined || holds(node.showIf, 'showIf'));
  const enabled = above.enabled && (node.enableIf === undefined || holds(node.enableIf, 'enableIf'));
  return shown === above.shown && enabled === above.enabled ? above : { shown, enabled };
}

/** What holds a node: a group, a section, or a leaf with fields, with its own scope and the scope it sits in. */
export interface PrefOwner {
  node: { showIf?: PrefCondition; enableIf?: PrefCondition };
  scope: PrefScope;
  above: PrefScope;
  /** The path of the list's or the map's entry the owner sits in (`'phases.2'`), under which a condition that reads
   *  the entry (`from: 'item'`) names its paths. Unset outside an entry, or where it has no one path. */
  entry?: string;
}

/**
 * The scope a leaf at `path` directly in `owner` sits in: the owner's, except
 * that the owner's own `enableIf` does not disable a leaf it reads. That leaf
 * is the owner's switch, and disabled by its own condition it could never be
 * turned back on. A test that reads the entry reads the leaf at its path
 * under `owner.entry`.
 */
export function prefScopeIn(owner: PrefOwner, path: string, holds: PrefConditionJudge): PrefScope {
  const { node, scope, above, entry } = owner;
  if (scope.enabled || !above.enabled || node.enableIf === undefined) return scope;
  const reads = prefConditionPaths(node.enableIf).includes(path)
    || (entry !== undefined && prefConditionPaths(node.enableIf, 'item').some((p) => `${entry}.${p}` === path));
  if (!reads) return scope;
  return prefScopeUnder(above, { showIf: node.showIf }, holds);
}

const under = (prefix: string, key: string): string => (prefix === '' ? key : `${prefix}.${key}`);

/** The scope of the field at `rest` among the members of `owner`, whose leaves' paths start at `prefix`, or `undefined` when none is there. */
function scopeAmong(
  held: PrefSection['members'], prefix: string, rest: string, owner: PrefOwner, holds: PrefConditionJudge,
): PrefScope | undefined {
  for (const [key, child] of Object.entries(held)) {
    if (!isPrefLeaf(child)) {
      const found = scopeAmong(child.members, prefix, rest, { node: child, scope: prefScopeUnder(owner.scope, child, holds), above: owner.scope }, holds);
      if (found) return found;
      continue;
    }
    if (rest !== key && !rest.startsWith(`${key}.`)) continue;
    const path = under(prefix, key);
    const sits = prefScopeIn(owner, path, holds);
    const scope = prefScopeUnder(sits, child, holds);
    return rest === key ? scope : scopeInside(child, path, rest.slice(key.length + 1), { node: child, scope, above: sits }, holds);
  }
  return undefined;
}

/** The scope at `rest` inside `owner`'s leaf, at `path`: that of a field, or the leaf's where `rest` names none. */
function scopeInside(leaf: PrefLeaf, path: string, rest: string, owner: PrefOwner, holds: PrefConditionJudge): PrefScope {
  const { scope } = owner;
  if (leaf.kind === 'object') return scopeAmong((leaf as PrefObject).children, path, rest, owner, holds) ?? scope;
  if (leaf.kind === 'list' || leaf.kind === 'map') {
    const { item } = leaf as Partial<PrefList | PrefMap>;
    if (item === undefined) return scope;
    const inItem = deferEntryConditions(holds);
    const entry = prefScopeUnder(scope, { enableIf: item.enableIf }, inItem);
    const dot = rest.indexOf('.');
    if (dot < 0) return entry;
    const at = `${path}.${rest.slice(0, dot)}`;
    return scopeInside(item, at, rest.slice(dot + 1), { node: { enableIf: item.enableIf }, scope: entry, above: scope }, inItem);
  }
  if (leaf.kind !== 'union') return scope;
  for (const variant of Object.values((leaf as PrefUnion).variants)) {
    const found = scopeAmong(variant.children, path, rest, owner, holds);
    if (found) return found;
  }
  return scope;
}

function scopeAt(schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge): PrefScope {
  let owner: PrefOwner = { node: schema, scope: prefScopeUnder(PREF_SCOPE, schema, holds), above: PREF_SCOPE };
  if (path === '') return owner.scope;
  if (isPrefSection(schema)) return scopeAmong(schema.members, '', path, owner, holds) ?? owner.scope;
  let node: PrefGroup = schema;
  const steps = path.split('.');
  for (let i = 0; i < steps.length; i++) {
    if (!Object.hasOwn(node.children, steps[i]!)) return owner.scope;
    const child: PrefLeaf | PrefGroup = node.children[steps[i]!]!;
    const at = steps.slice(0, i + 1).join('.');
    const sits = isPrefLeaf(child) ? prefScopeIn(owner, at, holds) : owner.scope;
    owner = { node: child, scope: prefScopeUnder(sits, child, holds), above: sits };
    if (isPrefLeaf(child)) return i === steps.length - 1 ? owner.scope : scopeInside(child, at, steps.slice(i + 1).join('.'), owner, holds);
    node = child;
  }
  return owner.scope;
}

/** `own`, an alias's scope by its own conditions, narrowed by that of the leaf it shows in `over`, as `holds` judges `over`. */
export function prefAliasScope(own: PrefScope, alias: PrefAlias, over: PrefGroup | PrefSection, holds: PrefConditionJudge): PrefScope {
  const target = prefAliasTarget(alias, (path) => prefLeafAt(over, path));
  if (target === undefined) return own;
  const theirs = scopeAt(over, target.path, holds);
  const shown = own.shown && theirs.shown;
  const enabled = own.enabled && theirs.enabled;
  return shown === own.shown && enabled === own.enabled ? own : { shown, enabled };
}

/** What {@link prefScopeAt} is told beyond the schema. */
export interface PrefScopeAtOptions {
  /** The schema an alias's `of` names a leaf of. Default: the schema asked. */
  aliasOver?: PrefGroup | PrefSection;
  /** Says which conditions of `aliasOver` hold, where its values are not the ones `holds` reads. Default: `holds`. */
  aliasHolds?: PrefConditionJudge;
}

/**
 * The scope of the node at `path`: a group, a leaf, a field of an `object`
 * or a `union` leaf, or an entry of a `list` or a `map`, whose step may be
 * any key. Under a {@link PrefSection} schema a leaf's key is its whole
 * path. A path that runs past the schema answers for the last node it
 * reaches. An alias answers for itself and for the leaf it shows, as
 * `applyPrefConditions` has it. Inside an entry, a condition that reads the
 * entry (`from: 'item'`) is not asked and counts as holding, there being no
 * entry here to read: `applyPrefEntryConditions` answers it.
 */
export function prefScopeAt(
  schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge, { aliasOver, aliasHolds }: PrefScopeAtOptions = {},
): PrefScope {
  const own = scopeAt(schema, path, holds);
  const leaf = prefLeafAt(schema, path);
  return leaf?.kind === 'alias' ? prefAliasScope(own, leaf as PrefAlias, aliasOver ?? schema, aliasHolds ?? holds) : own;
}
