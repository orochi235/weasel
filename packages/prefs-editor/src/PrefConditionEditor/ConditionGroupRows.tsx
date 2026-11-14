import type { ReactNode } from 'react';
import type { PrefCondition } from '@weasel-js/prefs';
import { Button, CloseButton, Select } from '@weasel-js/ui';
import { ConditionRow, type ConditionScope } from './ConditionRow';
import {
  clausesOf, type ConditionGroup, EMPTY_HOLDS, groupCondition, groupOf, leafKey, conditionLeafOf, nestedQuantifier,
  type Quantifier, QUANTIFIER_LABEL, rowAt, rowCondition, testRowOf,
} from '@weasel-js/prefs/edit';
import s from './PrefConditionEditor.module.css';

const QUANTIFIERS = (Object.keys(QUANTIFIER_LABEL) as Quantifier[]).map((value) => ({ value, label: QUANTIFIER_LABEL[value] }));

export interface ConditionGroupRowsProps {
  /** Names the group's controls, for a group inside another: `Condition 2`. Unset for the editor's own. */
  name?: string;
  group: ConditionGroup;
  scope: ConditionScope;
  onChange(next: ConditionGroup): void;
  /** Removes the group from the one it is in. */
  onRemove?(): void;
  /** Drawn at the end of the group's first line, which is then drawn whatever the group holds. */
  tools?: ReactNode;
}

/**
 * The rows of one group under its quantifier, and the controls that add to them. A row is a test, or a group
 * drawn the same way inside this one: a combinator, and any `not` no single comparison says.
 */
export function ConditionGroupRows({ name, group, scope, onChange, onRemove, tools }: ConditionGroupRowsProps) {
  const { quantifier, parts } = group;
  const of = name === undefined ? '' : ` of ${name.toLowerCase()}`;
  const to = name === undefined ? '' : ` to ${name.toLowerCase()}`;
  // A group added here starts at the quantifier this one is not, which is the one worth nesting.
  const inner = QUANTIFIER_LABEL[nestedQuantifier(quantifier)];
  const write = (next: readonly PrefCondition[]) => onChange({ quantifier, parts: next });
  const replace = (i: number, next: PrefCondition) => write(parts.map((p, j) => (j === i ? next : p)));
  const remove = (i: number) => write(parts.filter((_, j) => j !== i));
  // One row under all of is that row, with no quantifier worth showing.
  const quantified = name !== undefined || parts.length > 1 || quantifier !== 'all';
  return (
    <>
      {(quantified || tools) && (
        <div className={s.head}>
          {quantified && <Select className={s.quantifier} aria-label={`Which rows${of} must hold`} options={QUANTIFIERS} selectedKey={quantifier}
            onSelectionChange={(next) => { if (next !== quantifier) onChange({ quantifier: next as Quantifier, parts }); }} />}
          {tools}
          {onRemove && name && <CloseButton aria-label={`Remove ${name.toLowerCase()}`} onClick={onRemove} />}
        </div>
      )}
      {name !== undefined && parts.length === 0 && (
        <p className={s.empty}>No rows, which {EMPTY_HOLDS[quantifier] ? 'always' : 'never'} holds.</p>
      )}
      {parts.map((part, i) => {
        const rowName = name === undefined ? `Condition ${i + 1}` : `${name}.${i + 1}`;
        const row = testRowOf(part);
        const leaf = row && conditionLeafOf(scope.leaves, row.test)?.leaf;
        // A `not` no comparison says is none of the one test it wraps.
        if (row && (!row.negated || !leaf || clausesOf(row, leaf))) {
          return <ConditionRow key={i} name={rowName} row={row} scope={scope} onChange={(next) => replace(i, next)} onRemove={() => remove(i)} />;
        }
        return (
          <div key={i} className={s.group} role="group" aria-label={rowName}>
            <ConditionGroupRows name={rowName} group={groupOf(part)} scope={scope}
              onChange={(next) => replace(i, groupCondition(next))} onRemove={() => remove(i)} />
          </div>
        );
      })}
      <div className={s.foot}>
        <Select className={s.add} aria-label={`Add a condition${to}`} placeholder="Add a condition on…" selectedKey={null} options={scope.prefOptions}
          disabled={scope.prefOptions.length === 0}
          onSelectionChange={(key) => {
            const found = scope.leaves.find((l) => leafKey(l) === key);
            if (found) write([...parts, rowCondition(rowAt(found))]);
          }} />
        <Button variant="ghost" size="sm" aria-label={`Add ${inner.toLowerCase()} rows${to}`}
          onClick={() => write([...parts, groupCondition({ quantifier: nestedQuantifier(quantifier), parts: [] })])}>
          {inner}…
        </Button>
      </div>
    </>
  );
}
