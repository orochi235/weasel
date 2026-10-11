import { useMemo } from 'react';
import { checkPrefCondition, isPrefCondition, type PrefCondition, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { Code } from '../Code';
import { Select, type SelectOption } from '../Select';
import { ToggleBar } from '../ToggleBar';
import { ConditionRow } from './ConditionRow';
import { conditionLeaves, conditionParts, joinCondition, testOf, type ConditionMode } from './conditionRows';
import s from './PrefConditionEditor.module.css';

const MODES: ReadonlyArray<{ value: ConditionMode; label: string }> = [
  { value: 'all', label: 'All of' },
  { value: 'any', label: 'Any of' },
];

/** Props for {@link PrefConditionEditor}. */
export interface PrefConditionEditorProps {
  /** The condition edited; `undefined` is none. */
  value: PrefCondition | undefined;
  /** Called with the condition after each edit, and with `undefined` once its last row is removed. */
  onChange(next: PrefCondition | undefined): void;
  /** The schema the condition belongs to: a row reads one of its leaves, and the condition is checked against it. */
  schema: PrefGroup | PrefSection;
  /** What the condition decides, which names the group of controls: `Shown if`. */
  'aria-label'?: string;
  className?: string;
}

/**
 * An editor for one `PrefCondition` over a schema, as the `showIf` or `enableIf` of a pref, a group, or a section
 * holds it. Each test is a row: the pref it reads, picked from the schema's leaves; a comparison, from the ones
 * that leaf's kind offers; and a value, in the control that kind takes. A boolean is on or off; an enum is, is
 * not, or is one of its own options; a number is compared with a number; any other kind is set, which is to say
 * truthy. Two rows or more combine under all of or any of.
 *
 * A `not`, a combinator inside the top one, and a test with several operators or one its leaf's kind does not
 * offer are each a row of text, which can be removed and is otherwise handed back as the object it was. Whatever
 * `checkPrefCondition` finds wrong with a row is said on that row. With no rows left the condition is `undefined`.
 */
export function PrefConditionEditor({ value, onChange, schema, 'aria-label': ariaLabel, className }: PrefConditionEditorProps) {
  const leaves = useMemo(() => conditionLeaves(schema), [schema]);
  const prefOptions = useMemo<SelectOption[]>(() => leaves.map(({ path, leaf }) => ({
    value: path,
    label: <>{leaf.name || path} <span className={s.path}>{path}</span></>,
    textValue: `${leaf.name} ${path}`,
  })), [leaves]);
  const classes = [s.editor, className].filter(Boolean).join(' ');

  if (value !== undefined && !isPrefCondition(value)) {
    return (
      <div className={classes} role="group" aria-label={ariaLabel}>
        <div className={s.row} data-invalid>
          <Code size="xs" status="muted" className={s.text}>{JSON.stringify(value) ?? String(value)}</Code>
          <Button size="sm" onClick={() => onChange(undefined)}>Remove</Button>
          {checkPrefCondition(value, schema).map((p, i) => <p key={i} className={s.problem}>{p.problem}</p>)}
        </div>
      </div>
    );
  }

  const { mode, parts } = conditionParts(value);
  const write = (next: readonly PrefCondition[], as: ConditionMode = mode) => onChange(joinCondition(as, next));
  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {parts.length > 1 && (
        <ToggleBar ariaLabel="Which rows must hold" size="sm" items={MODES} value={mode}
          onChange={(next) => { if (next !== null && next !== mode) write(parts, next); }} />
      )}
      {parts.map((part, i) => (
        <ConditionRow key={i} n={i + 1} part={part} schema={schema} leaves={leaves} prefOptions={prefOptions}
          onChange={(next) => write(parts.map((p, j) => (j === i ? next : p)))}
          onRemove={() => write(parts.filter((_, j) => j !== i))} />
      ))}
      <Select aria-label="Add a condition" placeholder="Add a condition on…" selectedKey={null} options={prefOptions}
        isDisabled={leaves.length === 0}
        onSelectionChange={(path) => {
          const found = leaves.find((l) => l.path === path);
          if (found) write([...parts, testOf(found.path, found.leaf)]);
        }} />
    </div>
  );
}
