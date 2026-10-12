// What a schema's conditions come to once nesting is counted: a node is drawn
// only while it and everything above it is shown, and takes input only while
// it and everything above it is enabled. Every surface that draws a schema
// asks here.

import { prefAliasTarget, type PrefAlias } from './alias';
import { prefConditionHolds, type PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefLeafAt, prefValueAtPath } from './helpers';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { prefShownReader } from './shown';
import type { PrefUnion } from './union';

/** Which of a node's two conditions a {@link PrefConditionJudge} is asked about. */
export type PrefConditionField = 'showIf' | 'enableIf';

/**
 * Says whether one condition holds. {@link prefJudge} makes one from a value
 * reader; a surface drawing several values at once writes its own, to say
 * what a condition that holds for some and not for others comes to.
 */
export type PrefConditionJudge = (condition: PrefCondition, field: PrefConditionField) => boolean;

/**
 * A judge over one set of values, read by path. A condition compares each
 * value as the control over its leaf in `schema` shows it
 * ({@link prefShownReader}), so `read` hands back what is stored.
 */
export function prefJudge(schema: PrefGroup | PrefSection, read: (path: string) => unknown): PrefConditionJudge {
  const shown = prefShownReader(schema, read);
  return (condition) => prefConditionHolds(condition, shown);
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

/** Whether a node is drawn and whether it takes input, with what is above it counted. */
export interface PrefScope {
  shown: boolean;
  enabled: boolean;
}

/** The step that stands for any entry of a `list` or a `map` in a path: an item's conditions come to the same for
 *  every entry, so `'phases.*.hold'` answers for that field of each. */
export const PREF_ENTRY = '*';

/** The scope a schema's root sits in. */
export const PREF_SCOPE: PrefScope = Object.freeze({ shown: true, enabled: true });

type Conditioned = { showIf?: PrefCondition; enableIf?: PrefCondition };

/** The scope of `node`, which sits directly under something whose scope is `above`. */
export function prefScopeUnder(above: PrefScope, node: Conditioned, holds: PrefConditionJudge): PrefScope {
  const shown = above.shown && (node.showIf === undefined || holds(node.showIf, 'showIf'));
  const enabled = above.enabled && (node.enableIf === undefined || holds(node.enableIf, 'enableIf'));
  return shown === above.shown && enabled === above.enabled ? above : { shown, enabled };
}

const under = (prefix: string, key: string): string => (prefix === '' ? key : `${prefix}.${key}`);

/** A schema with its conditions applied. */
export interface PrefConditionsApplied<T> {
  /** The schema without the nodes that are not shown. The schema itself when
   *  that is all of it, and `null` when its root is not shown. */
  shown: T | null;
  /**
   * The value path of every leaf that is disabled, a field of an `object` or
   * a `union` leaf included (`'stroke.width'`), and under a {@link PrefGroup}
   * schema the path of every group that is. A `list`'s or a `map`'s item is
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
}

/**
 * `schema` as it is drawn while `holds` says which conditions hold. A node
 * whose `showIf` fails is dropped with everything under it, unless
 * `keepHidden`, and so is a group or a section that leaves with nothing to
 * draw, unless `keepEmpty`. A node
 * whose `enableIf` fails is disabled with everything under it. The item of
 * a `list` or a `map` is walked as its entries are drawn: its fields hide and
 * disable by their conditions, and its own `enableIf` disables every entry.
 * An alias is shown only while it and the leaf it shows both are, and enabled
 * only while both are, with everything above that leaf counted.
 * Parts with nothing dropped come back as the objects they were.
 */
export function applyPrefConditions<T extends PrefGroup | PrefSection>(
  schema: T,
  holds: PrefConditionJudge,
  { keepEmpty = false, keepHidden = false, aliasOver }: PrefConditionsOptions = {},
): PrefConditionsApplied<T> {
  const disabled = new Set<string>();
  const hidden = new Set<string>();

  const leaf = (node: PrefLeaf, path: string, above: PrefScope): PrefLeaf | null => {
    const own = prefScopeUnder(above, node, holds);
    const scope = node.kind === 'alias' ? withTarget(own, node as PrefAlias, aliasOver ?? schema, holds) : own;
    return scope.shown || keepHidden ? inside(node, path, scope) : null;
  };

  /** `node`, whose scope is `scope`, without what its own value hides: a field, or part of a list's or a map's item. */
  const inside = (node: PrefLeaf, path: string, scope: PrefScope): PrefLeaf => {
    if (!scope.shown) hidden.add(path);
    if (!scope.enabled) disabled.add(path);
    if (node.kind === 'object') {
      const children = members((node as PrefObject).children, path, scope);
      return children === (node as PrefObject).children ? node : ({ ...node, children } as PrefLeaf);
    }
    if (node.kind === 'list' || node.kind === 'map') {
      const { item } = node as Partial<PrefList | PrefMap>;
      // A leaf an app's renderer draws under a built-in's kind may hold no item.
      if (item === undefined) return node;
      // An item is drawn with its entry, so its own `showIf` is not asked.
      const entry = inside(item, under(path, PREF_ENTRY), prefScopeUnder(scope, { enableIf: item.enableIf }, holds));
      return entry === item ? node : ({ ...node, item: entry } as PrefLeaf);
    }
    if (node.kind !== 'union') return node;
    const { variants } = node as PrefUnion;
    let changed = false;
    const next: PrefUnion['variants'] = {};
    for (const [key, variant] of Object.entries(variants)) {
      const children = members(variant.children, path, scope);
      changed ||= children !== variant.children;
      next[key] = children === variant.children ? variant : { ...variant, children };
    }
    return changed ? ({ ...node, variants: next } as PrefLeaf) : node;
  };

  /** A section's members or an object leaf's children. `prefix` is the object leaf's path, empty in a section schema. */
  const members = (held: PrefSection['members'], prefix: string, above: PrefScope): PrefSection['members'] => {
    let changed = false;
    const out: PrefSection['members'] = {};
    for (const [key, child] of Object.entries(held)) {
      const kept = isPrefLeaf(child) ? leaf(child, under(prefix, key), above) : section(child, prefix, above);
      changed ||= kept !== child;
      if (kept !== null) out[key] = kept;
    }
    return changed ? out : held;
  };

  const section = (node: PrefSection, prefix: string, above: PrefScope): PrefSection | null => {
    const scope = prefScopeUnder(above, node, holds);
    if (!scope.shown && !keepHidden) return null;
    const kept = members(node.members, prefix, scope);
    if (kept === node.members) return node;
    return Object.keys(kept).length === 0 && !keepEmpty ? null : { ...node, members: kept };
  };

  const group = (node: PrefGroup, path: string, above: PrefScope): PrefGroup | null => {
    const scope = prefScopeUnder(above, node, holds);
    if (!scope.shown && !keepHidden) return null;
    if (!scope.shown && path !== '') hidden.add(path);
    if (!scope.enabled && path !== '') disabled.add(path);
    let changed = false;
    const children: PrefGroup['children'] = {};
    for (const [key, child] of Object.entries(node.children)) {
      const at = under(path, key);
      const kept = isPrefLeaf(child) ? leaf(child, at, scope) : group(child, at, scope);
      changed ||= kept !== child;
      if (kept !== null) children[key] = kept;
    }
    if (!changed) return node;
    return Object.keys(children).length === 0 && !keepEmpty && path !== '' ? null : { ...node, children };
  };

  if (!isPrefSection(schema)) return { shown: group(schema, '', PREF_SCOPE) as T | null, disabled, hidden };
  const scope = prefScopeUnder(PREF_SCOPE, schema, holds);
  if (!scope.shown && !keepHidden) return { shown: null, disabled, hidden };
  const kept = members(schema.members, '', scope);
  return { shown: kept === schema.members ? schema : { ...schema, members: kept }, disabled, hidden };
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
    const entry = prefScopeUnder(scope, { enableIf: item.enableIf }, holds);
    const dot = rest.indexOf('.');
    return dot < 0 ? entry : scopeInside(item, rest.slice(dot + 1), entry, holds);
  }
  if (leaf.kind !== 'union') return scope;
  for (const variant of Object.values((leaf as PrefUnion).variants)) {
    const found = scopeAmong(variant.children, rest, scope, holds);
    if (found) return found;
  }
  return scope;
}

/** `own`, an alias's scope by its own conditions, narrowed by that of the leaf it shows in `over`. */
function withTarget(own: PrefScope, alias: PrefAlias, over: PrefGroup | PrefSection, holds: PrefConditionJudge): PrefScope {
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
}

/**
 * The scope of the node at `path`: a group, a leaf, a field of an `object`
 * or a `union` leaf, or an entry of a `list` or a `map`, whose step may be
 * any key. Under a {@link PrefSection} schema a leaf's key is its whole
 * path. A path that runs past the schema answers for the last node it
 * reaches. An alias answers for itself and for the leaf it shows, as
 * {@link applyPrefConditions} has it.
 */
export function prefScopeAt(
  schema: PrefGroup | PrefSection, path: string, holds: PrefConditionJudge, { aliasOver }: PrefScopeAtOptions = {},
): PrefScope {
  const own = scopeAt(schema, path, holds);
  const leaf = prefLeafAt(schema, path);
  return leaf?.kind === 'alias' ? withTarget(own, leaf as PrefAlias, aliasOver ?? schema, holds) : own;
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
