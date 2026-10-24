import { useMemo } from 'react';
import { checkPrefCondition, isPrefCondition, type PrefCondition, type PrefConditionSite, type PrefGroup, type PrefList, type PrefMap, type PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { Code } from '../Code';
import type { SelectOption } from '../Select';
import { ConditionClipboard } from './ConditionClipboard';
import { ConditionGroupRows } from './ConditionGroupRows';
import type { ConditionScope } from './ConditionRow';
import { rootCondition, rootGroup } from './conditionGroups';
import { conditionLeaves, leafKey } from './conditionLeaves';
import s from './PrefConditionEditor.module.css';

const NO_PATHS: readonly string[] = [];

/** Props for {@link PrefConditionEditor}. */
export interface PrefConditionEditorProps {
  /** The condition edited; `undefined` is none. */
  value: PrefCondition | undefined;
  /** Called with the condition after each edit, and with `undefined` once its last row is removed. */
  onChange(next: PrefCondition | undefined): void;
  /** The schema the condition belongs to: a row reads one of its leaves, and the condition is checked against it. */
  schema: PrefGroup | PrefSection;
  /**
   * The schema `schema` is drawn over, as a layout is over its dialog's: a condition may read a pref of it at any
   * path no leaf of `schema` holds. The pickers offer those prefs after `schema`'s own, each named for this schema,
   * and a row on one is checked against it.
   */
  over?: PrefGroup | PrefSection;
  /**
   * Value paths no row is offered: the pref at one, and every pref beneath one, is left out of the pickers. For
   * what the condition belongs to, which cannot sensibly be shown or enabled by its own value. A row that
   * already reads such a pref keeps it.
   */
  exclude?: readonly string[];
  /**
   * The list or map whose entry the condition's node is drawn in: the one it is the `item` of, or sits inside the
   * item of. The pickers then offer that entry's own fields first, each named as the entry's, and a row on one
   * writes a test that reads from the entry (`from: 'item'`). Unset, the node is in no entry.
   */
  entryOf?: PrefList | PrefMap;
  /** What the condition decides, which names the group of controls: `Shown if`. */
  'aria-label'?: string;
  className?: string;
}

/**
 * An editor for one `PrefCondition` over a schema, as the `showIf` or `enableIf` of a pref, a group, or a section
 * holds it. Each test is a row: the pref it reads, picked from the schema's leaves; a comparison, from the ones
 * that leaf's kind offers; and a value, in the control that kind takes. A boolean is on or off; an enum is, is
 * not, is one of, or is none of its own options; a number is compared with a number, or with two as a range; any
 * other kind is set or not, which for a list or a map is to say it has an entry.
 *
 * Rows combine under a quantifier: all of, any of, none of, or not all of them. A group added among the rows
 * holds rows of its own under its own quantifier, to any depth, and that is how an `all` inside an `any` and a
 * `not` around either are drawn. Whatever `checkPrefCondition` finds wrong with a row is said on that row. With
 * no rows left the condition is `undefined`.
 *
 * Copy puts the whole condition on the clipboard as JSON, and Paste replaces it with one read from there: how a
 * condition gets from one pref to another. A pasted test that reads a pref this schema lacks says so on its row.
 */
export function PrefConditionEditor({ value, onChange, schema, over, exclude = NO_PATHS, entryOf, 'aria-label': ariaLabel, className }: PrefConditionEditorProps) {
  const leaves = useMemo(() => conditionLeaves(schema, entryOf, over), [schema, entryOf, over]);
  const site = useMemo<PrefConditionSite>(() => (entryOf ? { within: entryOf } : {}), [entryOf]);
  const prefOptions = useMemo<SelectOption[]>(() => leaves
    .filter((found) => found.from === 'item' || found.over || !exclude.some((out) => found.path === out || found.path.startsWith(`${out}.`)))
    .map((found) => {
      const { path, leaf, from } = found;
      // A field of the entry is named as the entry's, so it reads apart from a root pref at the same path; a pref
      // of the schema this one is drawn over is named for that schema.
      const where = from === 'item' ? `this ${entryOf?.item.name || 'entry'}: ${path}` : found.over ? `${over?.name || 'another schema'}: ${path}` : path;
      return {
        value: leafKey(found),
        label: <>{leaf.name || path} <span className={s.path}>{where}</span></>,
        textValue: `${leaf.name} ${where}`,
      };
    }), [leaves, exclude, entryOf, over]);
  const classes = [s.editor, className].filter(Boolean).join(' ');

  if (value !== undefined && !isPrefCondition(value)) {
    return (
      <div className={classes} role="group" aria-label={ariaLabel}>
        <div className={s.row} data-invalid>
          <Code size="xs" emphasis="low" className={s.text}>{JSON.stringify(value) ?? String(value)}</Code>
          <Button size="sm" onClick={() => onChange(undefined)}>Remove</Button>
          {checkPrefCondition(value, schema, site, over).map((p, i) => <p key={i} className={s.problem}>{p.problem}</p>)}
        </div>
      </div>
    );
  }

  // A page not served securely has no clipboard, and then neither button is drawn.
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  const scope: ConditionScope = { schema, over, site, leaves, prefOptions };
  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      <ConditionGroupRows group={rootGroup(value)} scope={scope} onChange={(next) => onChange(rootCondition(next))}
        tools={clipboard && <ConditionClipboard clipboard={clipboard} value={value} onPaste={onChange} />} />
    </div>
  );
}
