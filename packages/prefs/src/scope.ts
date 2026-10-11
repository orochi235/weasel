// What a schema's conditions come to once nesting is counted: a node is drawn
// only while it and everything above it is shown, and takes input only while
// it and everything above it is enabled. Every surface that draws a schema
// asks here.

import { prefConditionHolds, type PrefCondition } from './condition';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefValueAtPath } from './helpers';
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
   * schema the path of every group that is. An entry of a `list` or a `map`
   * is disabled with its leaf, and has no path here.
   */
  disabled: ReadonlySet<string>;
}

/**
 * `schema` as it is drawn while `holds` says which conditions hold. A node
 * whose `showIf` fails is dropped with everything under it, and so is a group
 * or a section that leaves with nothing to draw, unless `keepEmpty`. A node
 * whose `enableIf` fails is disabled with everything under it. Parts with
 * nothing dropped come back as the objects they were.
 */
export function applyPrefConditions<T extends PrefGroup | PrefSection>(
  schema: T,
  holds: PrefConditionJudge,
  keepEmpty = false,
): PrefConditionsApplied<T> {
  const disabled = new Set<string>();

  const leaf = (node: PrefLeaf, path: string, above: PrefScope): PrefLeaf | null => {
    const scope = prefScopeUnder(above, node, holds);
    if (!scope.shown) return null;
    if (!scope.enabled) disabled.add(path);
    if (node.kind === 'object') {
      const children = members((node as PrefObject).children, path, scope);
      return children === (node as PrefObject).children ? node : ({ ...node, children } as PrefLeaf);
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
    if (!scope.shown) return null;
    const kept = members(node.members, prefix, scope);
    if (kept === node.members) return node;
    return Object.keys(kept).length === 0 && !keepEmpty ? null : { ...node, members: kept };
  };

  const group = (node: PrefGroup, path: string, above: PrefScope): PrefGroup | null => {
    const scope = prefScopeUnder(above, node, holds);
    if (!scope.shown) return null;
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

  if (!isPrefSection(schema)) return { shown: group(schema, '', PREF_SCOPE) as T | null, disabled };
  const scope = prefScopeUnder(PREF_SCOPE, schema, holds);
  if (!scope.shown) return { shown: null, disabled };
  const kept = members(schema.members, '', scope);
  return { shown: kept === schema.members ? schema : { ...schema, members: kept }, disabled };
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
  if (leaf.kind !== 'union') return scope;
  for (const variant of Object.values((leaf as PrefUnion).variants)) {
    const found = scopeAmong(variant.children, rest, scope, holds);
    if (found) return found;
  }
  return scope;
}

/**
 * The scope of the node at `path` in a {@link PrefGroup} schema: a group, a
 * leaf, or a field of an `object` or a `union` leaf. A path that runs past
 * the schema answers for the last node it reaches.
 */
export function prefScopeAt(schema: PrefGroup, path: string, holds: PrefConditionJudge): PrefScope {
  let scope = prefScopeUnder(PREF_SCOPE, schema, holds);
  if (path === '') return scope;
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
