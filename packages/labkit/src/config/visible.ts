import {
  applyPrefConditions,
  applyPrefEntryConditions,
  PREF_SCOPE,
  type PrefAlias,
  type PrefAliasTargets,
  type PrefConditionJudge,
  type PrefEntryApplied,
  type PrefGroup,
  type PrefLeaf,
  type PrefScope,
  type PrefSection,
  prefAliasTargets,
  prefConditionHolds,
  prefJudge,
  prefLeafAt,
  prefReader,
  prefScopeAt,
  prefScopeUnder,
} from '@weasel-js/prefs';
import { schemaNodeAtPath, valueAtPath } from './path';
import type { ConfigEntry, ResolvedConfig } from './types';

/**
 * The schema a panel's aliases point into, as its conditions leave it:
 * `over`, or the panel's own. A config holds a value for every leaf of its
 * own schema and none for another's, so `over` is read with its defaults.
 */
export function aliasTargetsOf(
  resolved: ResolvedConfig,
  config: Record<string, unknown>,
  over?: PrefGroup | PrefSection,
): PrefAliasTargets {
  const of = over ?? resolved.group;
  const read = over ? prefReader(over, config) : (at: string): unknown => valueAtPath(config, at);
  return prefAliasTargets(of, (entry) => prefJudge(of, read, entry), { showHidden: true });
}

/**
 * Whether the node at a dotted path is shown and enabled, with every group
 * above it counted. The conditions the schema carries as data are core's to
 * answer (`prefScopeAt`); the functions beside the tree are asked here, for
 * the node and for each group on the way to it.
 */
function scopeAt(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  over?: PrefGroup | PrefSection,
): PrefScope {
  const targets = aliasTargetsOf(resolved, config, over);
  const data = prefScopeAt(
    resolved.group,
    path,
    prefJudge(resolved.group, (at) => valueAtPath(config, at)),
    { aliasOver: over ?? resolved.group, aliasHolds: targets.holds },
  );
  let { shown, enabled } = data;
  // An alias answers for the leaf it shows as well, as `prefScopeAt` has it for the data conditions.
  const leaf = prefLeafAt(resolved.group, path);
  const target = leaf?.kind === 'alias' ? targets.shown(leaf as PrefAlias) : undefined;
  for (const asked of target ? [path, target.path] : [path]) {
    const steps = asked.split('.');
    for (let i = 1; i <= steps.length; i += 1) {
      const at = steps.slice(0, i).join('.');
      shown &&= resolved.showIf.get(at)?.(config) ?? true;
      enabled &&= resolved.enableIf?.get(at)?.(config) ?? true;
    }
  }
  return { shown, enabled };
}

/**
 * Whether the row at a dotted path should be drawn right now: its `showIf`
 * holds, as a condition or a function, and so does that of every group above
 * it. `hidden` is the node's own static flag. Both are presentational — a
 * hidden leaf keeps its value and the instrument still reads it. `over` is
 * the schema the panel's aliases point into, where that is not its own.
 */
export function isLeafVisible(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  showHidden = false,
  over?: PrefGroup | PrefSection,
): boolean {
  const node = schemaNodeAtPath(resolved.group, path);
  if (node && 'hidden' in node && node.hidden === true && !showHidden) return false;
  return scopeAt(resolved, path, config, over).shown;
}

/**
 * Whether the row at a dotted path takes input right now: its `enableIf`
 * holds, and so does that of every group above it. `over` is the schema
 * the panel's aliases point into, where that is not its own.
 */
export function isLeafEnabled(
  resolved: ResolvedConfig,
  path: string,
  config: Record<string, unknown>,
  over?: PrefGroup | PrefSection,
): boolean {
  return scopeAt(resolved, path, config, over).enabled;
}

/**
 * A leaf whose value is made of others', as its dialog draws it: `leaf`
 * without the fields a `showIf` hides, in an object, a union's variants, and a
 * list's or a map's item, and `disabledAt`, which says whether an `enableIf`
 * disables the field at a path under it. `entryAt` answers the conditions
 * that read an entry of a list or a map (`from: 'item'`), for the entry it is
 * given. The functions beside the tree place rows only, so the data
 * conditions are all there is to ask inside a leaf.
 */
export function conditionedLeaf(
  resolved: ResolvedConfig,
  path: string,
  leaf: PrefLeaf,
  config: Record<string, unknown>,
): {
  leaf: PrefLeaf;
  disabledAt: (at: string) => boolean;
  entryAt: (item: PrefLeaf, at: string, value: unknown) => PrefEntryApplied;
} {
  const read = (at: string): unknown => valueAtPath(config, at);
  const judge = prefJudge(resolved.group, read);
  const { shown, disabled } = applyPrefConditions(resolved.group, judge, { keepEmpty: true });
  const drawn = shown === null ? undefined : prefLeafAt(shown, path);
  // An alias draws its target under its own name, which the tree does not hold.
  const own =
    drawn?.kind === leaf.kind ? { ...drawn, name: leaf.name, description: leaf.description } : leaf;
  return {
    leaf: own,
    disabledAt: (at) => disabled.has(at),
    entryAt: (item, at, value) =>
      applyPrefEntryConditions(item, at, prefJudge(resolved.group, read, { item, value })),
  };
}

/**
 * Whether a node of a schema not yet resolved is drawn by its own `showIf`,
 * as a condition or a function. It answers for the node alone: a walk that
 * skips what is under a node not shown counts the nesting. With no resolved
 * schema to read a leaf's `encoding` from, a condition compares stored values.
 */
export function isEntryShown(entry: ConfigEntry, config: Record<string, unknown>): boolean {
  const judge: PrefConditionJudge = (condition) =>
    prefConditionHolds(condition, (at) => valueAtPath(config, at));
  if (!prefScopeUnder(PREF_SCOPE, entry.annotations, judge).shown) return false;
  return entry.options.showIf?.(config) ?? true;
}
