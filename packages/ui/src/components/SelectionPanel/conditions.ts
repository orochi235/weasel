import type { NodePropertiesEntry } from '@weasel-js/core';
import { applyPrefConditions, prefJudge, prefLeafAt, type PrefConditionJudge, type PrefEntry, type PrefSection } from '@weasel-js/prefs';
import { entryApplier, type EntryAt } from '../Prefs/entry';
import { absentValue, effectiveSections, nodeValueAt, type AnyNode, type PanelSection } from './model';

/**
 * Whether a condition of `schema` holds across `nodes`, each read at its own
 * values: a `showIf` holds while it does for any node, an `enableIf` only
 * while it does for all of them. A test that reads from an entry of a list
 * or a map reads `entry`, the one being drawn.
 */
export function selectionJudge(schema: PrefSection, nodes: readonly AnyNode[], entry?: PrefEntry): PrefConditionJudge {
  const judges = nodes.map((node) =>
    prefJudge(schema, (path) => {
      const held = nodeValueAt(node, path);
      if (held !== undefined) return held;
      const leaf = prefLeafAt(schema, path);
      return leaf && absentValue(leaf);
    }, entry),
  );
  return (condition, field) =>
    field === 'showIf' ? judges.some((holds) => holds(condition, field)) : judges.every((holds) => holds(condition, field));
}

/**
 * {@link effectiveSections} with each kind's conditions applied against
 * `nodes`: the sections without what a `showIf` hides, and the key of every
 * leaf, and the path of every field of an object leaf, an `enableIf` disables.
 * With `keepHidden` nothing a `showIf` hides is left out, and `hidden` names
 * each such leaf and field the same way. `entryAt` answers the conditions
 * that read an entry of a list or a map, for the entry it is given.
 */
export function conditionedSections(
  kinds: readonly string[],
  entries: readonly NodePropertiesEntry[],
  nodes: readonly AnyNode[],
  rawAliases = false,
  keepHidden = false,
): { sections: PanelSection[]; disabled: ReadonlySet<string>; hidden: ReadonlySet<string>; entryAt: EntryAt } {
  const disabled = new Set<string>();
  const hidden = new Set<string>();
  const schemas: PrefSection[] = [];
  const sections = effectiveSections(kinds, entries, rawAliases, (schema) => {
    schemas.push(schema);
    const applied = applyPrefConditions(schema, selectionJudge(schema, nodes), { keepHidden });
    for (const path of applied.disabled) disabled.add(path);
    for (const path of applied.hidden) hidden.add(path);
    return applied.shown;
  });
  // The rule of `selectionJudge`, across every kind selected as across every node.
  const entryAt = entryApplier((entry) => {
    const judges = schemas.map((schema) => selectionJudge(schema, nodes, entry));
    return (condition, field) =>
      field === 'showIf' ? judges.some((holds) => holds(condition, field)) : judges.every((holds) => holds(condition, field));
  }, keepHidden);
  return { sections, disabled, hidden, entryAt };
}
