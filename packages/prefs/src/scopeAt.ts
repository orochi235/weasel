// The scope of one node: whether it is drawn and whether it takes input,
// with everything above it counted.

import { prefAliasTarget, type PrefAlias } from './alias';
import type { PrefCondition } from './condition';
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

/** The scope of the field at `rest` among an object leaf's children, or `undefined` when none is there. */
function scopeAmong(
  held: PrefSection['members'], rest: string, above: PrefScope, holds: PrefConditionJudge,
): PrefScope | undefined {
  for (const [key, child] of Object.entries(held)) {
    if (!isPrefLeaf(child)) {
      const found = scopeAmong(child.members, rest, prefScopeUnder(above, child, holds), holds);
      if (found) return found;
    } else if (rest === key) return prefScopeUnder(above, child, holds);
    else if (rest.startsWith(`${key}.`)) return scopeInside(child, rest.slice(key.length + 1), prefScopeUnder(above, child, holds), holds);
  }
  return undefined;
}

/** The scope at `rest` inside `leaf`, whose own scope is `scope`: that of a field, or the leaf's where `rest` names none. */
function scopeInside(leaf: PrefLeaf, rest: string, scope: PrefScope, holds: PrefConditionJudge): PrefScope {
  if (leaf.kind === 'object') return scopeAmong((leaf as PrefObject).children, rest, scope, holds) ?? scope;
  if (leaf.kind === 'list' || leaf.kind === 'map') {
    const { item } = leaf as Partial<PrefList | PrefMap>;
    if (item === undefined) return scope;
    const inItem = deferEntryConditions(holds);
    const entry = prefScopeUnder(scope, { enableIf: item.enableIf }, inItem);
    const dot = rest.indexOf('.');
    return dot < 0 ? entry : scopeInside(item, rest.slice(dot + 1), entry, inItem);
  }
  if (leaf.kind !== 'union') return scope;
  for (const variant of Object.values((leaf as PrefUnion).variants)) {
    const found = scopeAmong(variant.children, rest, scope, holds);
    if (found) return found;
  }
  return scope;
}

function scopeAt(schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge): PrefScope {
  let scope = prefScopeUnder(PREF_SCOPE, schema, holds);
  if (path === '') return scope;
  if (isPrefSection(schema)) return scopeAmong(schema.members, path, scope, holds) ?? scope;
  let node: PrefGroup = schema;
  const steps = path.split('.');
  for (let i = 0; i < steps.length; i++) {
    if (!Object.hasOwn(node.children, steps[i]!)) return scope;
    const child: PrefLeaf | PrefGroup = node.children[steps[i]!]!;
    scope = prefScopeUnder(scope, child, holds);
    if (isPrefLeaf(child)) return i === steps.length - 1 ? scope : scopeInside(child, steps.slice(i + 1).join('.'), scope, holds);
    node = child;
  }
  return scope;
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
