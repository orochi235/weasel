import type { NodePropertiesEntry } from '@weasel-js/core';
import { applyPrefConditions, prefJudge, prefLeafAt, type PrefConditionJudge, type PrefSection } from '@weasel-js/prefs';
import { absentValue, effectiveSections, nodeValueAt, type AnyNode, type PanelSection } from './model';

/**
 * Whether a condition of `schema` holds across `nodes`, each read at its own
 * values: a `showIf` holds while it does for any node, an `enableIf` only
 * while it does for all of them. Provisional for more than one node.
 */
export function selectionJudge(schema: PrefSection, nodes: readonly AnyNode[]): PrefConditionJudge {
  const judges = nodes.map((node) =>
    prefJudge(schema, (path) => {
      const held = nodeValueAt(node, path);
      if (held !== undefined) return held;
      const leaf = prefLeafAt(schema, path);
      return leaf && absentValue(leaf);
    }),
  );
  return (condition, field) =>
    field === 'showIf' ? judges.some((holds) => holds(condition, field)) : judges.every((holds) => holds(condition, field));
}

/**
 * {@link effectiveSections} with each kind's conditions applied against
 * `nodes`: the sections without what a `showIf` hides, and the key of every
 * leaf, and the path of every field of an object leaf, an `enableIf` disables.
 */
export function conditionedSections(
  kinds: readonly string[],
  entries: readonly NodePropertiesEntry[],
  nodes: readonly AnyNode[],
  rawAliases = false,
): { sections: PanelSection[]; disabled: ReadonlySet<string> } {
  const disabled = new Set<string>();
  const sections = effectiveSections(kinds, entries, rawAliases, (schema) => {
    const applied = applyPrefConditions(schema, selectionJudge(schema, nodes));
    for (const path of applied.disabled) disabled.add(path);
    return applied.shown;
  });
  return { sections, disabled };
}
