import {
  applyPrefConditions,
  isPrefLeaf,
  prefConditionReadsItem,
  prefJudge,
  prefLeafAt,
  type PrefCondition,
  type PrefConditionField,
  type PrefConditionJudge,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
  type PrefSection,
  type PrefUnion,
} from '@weasel-js/prefs';
import { valueAtPath } from './path';
import type { ResolvedConfig } from './types';

const ALWAYS: PrefCondition = { all: [] };
const NEVER: PrefCondition = { any: [] };

type Conditioned = { showIf?: PrefCondition; enableIf?: PrefCondition };

/**
 * A resolved schema's conditions answered against its config, for a form drawn
 * over a tree whose paths are not the config's, where a condition naming a
 * config path would read nothing.
 */
export interface ConfigVerdict {
  /** The config path of every leaf, group and field an `enableIf` disables,
   *  as a function or as a condition, named as `applyPrefConditions` names them. */
  disabled: ReadonlySet<string>;
  /** The row at a config path as the form should get it: no condition of its
   *  own, no field a `showIf` hides, and inside it only the conditions that
   *  read a list's or a map's entry, with every other test in them answered. */
  rowAt: (path: string, leaf: PrefLeaf) => PrefLeaf;
}

/** `resolved.group` with each `enableIf` function that fails folded into the node's condition, so one walk answers both. */
function withFunctions(resolved: ResolvedConfig, config: Record<string, unknown>): PrefGroup {
  const fns = resolved.enableIf;
  if (!fns || fns.size === 0) return resolved.group;
  const fold = <N extends PrefLeaf | PrefGroup>(node: N, path: string): N => {
    const fn = fns.get(path);
    // Kept beside the node's own, so a leaf that condition reads still switches the group.
    const own: N = fn && !fn(config) ? { ...node, enableIf: node.enableIf ? { all: [node.enableIf, NEVER] } : NEVER } : node;
    if (isPrefLeaf(own)) return own;
    const children: PrefGroup['children'] = {};
    for (const [key, child] of Object.entries(own.children)) children[key] = fold(child, path === '' ? key : `${path}.${key}`);
    return { ...own, children };
  };
  return fold(resolved.group, '');
}

/** `condition` where it reads an entry, which only the form has, with its other tests answered; else nothing. */
function settled(condition: PrefCondition | undefined, field: PrefConditionField, holds: PrefConditionJudge): PrefCondition | undefined {
  if (condition === undefined || !prefConditionReadsItem(condition)) return undefined;
  const fold = (c: PrefCondition): PrefCondition => {
    if ('all' in c) return { all: c.all.map(fold) };
    if ('any' in c) return { any: c.any.map(fold) };
    if ('not' in c) return { not: fold(c.not) };
    if (c.from === 'item') return c;
    return holds(c, field) ? ALWAYS : NEVER;
  };
  return fold(condition);
}

function settle<N extends Conditioned>(node: N, holds: PrefConditionJudge): N {
  const { showIf, enableIf, ...rest } = node;
  const shown = settled(showIf, 'showIf', holds);
  const enabled = settled(enableIf, 'enableIf', holds);
  return { ...rest, ...(shown && { showIf: shown }), ...(enabled && { enableIf: enabled }) } as N;
}

/** What is inside `leaf`, its fields, a list's or a map's item and a union's variants, with each condition settled. */
function settleInside(leaf: PrefLeaf, holds: PrefConditionJudge): PrefLeaf {
  const members = (held: PrefSection['members']): PrefSection['members'] => {
    const out: PrefSection['members'] = {};
    for (const [key, child] of Object.entries(held)) {
      out[key] = isPrefLeaf(child)
        ? settleInside(settle(child, holds), holds)
        : { ...settle(child, holds), members: members(child.members) };
    }
    return out;
  };
  if (leaf.kind === 'object') return { ...leaf, children: members((leaf as PrefObject).children) } as PrefLeaf;
  if (leaf.kind === 'union') {
    const variants: PrefUnion['variants'] = {};
    for (const [key, variant] of Object.entries((leaf as PrefUnion).variants)) {
      variants[key] = { ...variant, children: members(variant.children) };
    }
    return { ...leaf, variants } as PrefLeaf;
  }
  const { item } = leaf as { item?: PrefLeaf };
  if ((leaf.kind === 'list' || leaf.kind === 'map') && item !== undefined) {
    return { ...leaf, item: settleInside(settle(item, holds), holds) } as PrefLeaf;
  }
  return leaf;
}

/** Answer every condition of `resolved` against `config`, data and function alike. */
export function configVerdict(resolved: ResolvedConfig, config: Record<string, unknown>): ConfigVerdict {
  const holds = prefJudge(resolved.group, (at) => valueAtPath(config, at));
  const { shown, disabled } = applyPrefConditions(withFunctions(resolved, config), holds, { keepEmpty: true });
  return {
    disabled,
    rowAt: (path, leaf) => {
      const drawn = shown === null ? undefined : prefLeafAt(shown, path);
      const { showIf: _shown, enableIf: _enabled, ...own } = drawn?.kind === leaf.kind ? drawn : leaf;
      return settleInside(own, holds);
    },
  };
}

/** Strip a group's own conditions, already answered against the config. */
export function bareGroup(group: PrefGroup): PrefGroup {
  const { showIf: _shown, enableIf: _enabled, ...rest } = group;
  return rest;
}
