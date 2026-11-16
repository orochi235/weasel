import { applyPrefConditions, prefAliasTargets, prefJudge, prefLeafAt, prefSchemaHolding, type PrefAliasTargets, type PrefConditionJudge, type PrefEntry, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { entryApplier, type EntryAt } from '../Prefs/entry';
import { effectiveSections, nodeLeafValue, type PanelRecord, type PanelSchemaEntry, type PanelSection } from './model';

/**
 * Whether a condition of `schema` holds across `records`, each read at its own
 * values: a `showIf` holds while it does for any record, an `enableIf` only
 * while it does for all of them. A test that reads from an entry of a list
 * or a map reads `entry`, the one being drawn. `over` is the schema `schema`
 * is drawn over: a path no leaf of `schema` holds is read as the leaf of
 * `over` there says, a record holding nothing included.
 */
export function selectionJudge(
  schema: PrefGroup | PrefSection, records: readonly PanelRecord[], entry?: PrefEntry, over?: PrefGroup | PrefSection,
): PrefConditionJudge {
  const judges = records.map((record) =>
    prefJudge(schema, (path) => {
      const held = record.valueAt(path);
      const leaf = prefLeafAt(prefSchemaHolding(schema, path, over), path);
      return leaf ? nodeLeafValue(leaf, held) : held;
    }, entry, over),
  );
  return (condition, field) =>
    field === 'showIf' ? judges.some((holds) => holds(condition, field)) : judges.every((holds) => holds(condition, field));
}

/**
 * {@link effectiveSections} with each kind's conditions applied against
 * `records`: the sections without what a `showIf` hides, and the key of every
 * leaf, and the path of every field of an object leaf, an `enableIf` disables, and in `active` the key of every
 * action whose `activeIf` holds for every record.
 * With `keepHidden` nothing a `showIf` hides is left out, and `hidden` names
 * each such leaf and field the same way. `entryAt` answers the conditions
 * that read an entry of a list or a map, for the entry it is given.
 * `over` is the schema the kinds' aliases point into, read across `records`
 * as each kind's own is, and the one a kind's own condition reads a path
 * at that no leaf of the kind holds; without it an alias points into its
 * own kind's schema. `targets` is that schema as its conditions leave it, which what
 * is inside an alias's row answers to, and is handed back only with `over`.
 */
export function conditionedSections(
  kinds: readonly string[],
  entries: readonly PanelSchemaEntry[],
  records: readonly PanelRecord[],
  rawAliases = false,
  keepHidden = false,
  over?: PrefGroup | PrefSection,
): { sections: PanelSection[]; disabled: ReadonlySet<string>; hidden: ReadonlySet<string>; active: ReadonlySet<string>; entryAt: EntryAt; targets?: PrefAliasTargets } {
  const disabled = new Set<string>();
  const hidden = new Set<string>();
  const active = new Set<string>();
  const schemas: PrefSection[] = [];
  // A panel draws every field a leaf holds, so its aliases do.
  const targetsIn = (of: PrefGroup | PrefSection): PrefAliasTargets =>
    prefAliasTargets(of, (entry) => selectionJudge(of, records, entry), { showHidden: true, markHidden: keepHidden });
  const shared = over && targetsIn(over);
  const sections = effectiveSections(kinds, entries, rawAliases, (schema) => {
    schemas.push(schema);
    const targets = shared ?? targetsIn(schema);
    const applied = applyPrefConditions(schema, selectionJudge(schema, records, undefined, over), { keepHidden, aliasOver: over ?? schema, aliasHolds: targets.holds });
    for (const path of applied.disabled) disabled.add(path);
    for (const path of applied.hidden) hidden.add(path);
    for (const path of applied.active) active.add(path);
    return { schema: applied.shown, targets };
  });
  // The rule of `selectionJudge`, across every kind selected as across every record.
  const entryAt = entryApplier((entry) => {
    const judges = schemas.map((schema) => selectionJudge(schema, records, entry, over));
    return (condition, field) =>
      field === 'showIf' ? judges.some((holds) => holds(condition, field)) : judges.every((holds) => holds(condition, field));
  }, keepHidden);
  return { sections, disabled, hidden, active, entryAt, ...(shared ? { targets: shared } : {}) };
}
