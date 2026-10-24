import { Fragment } from 'react';
import { checkPrefCondition, type PrefCondition, type PrefConditionSite, type PrefEnum, type PrefGroup, type PrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { CloseButton } from '../CloseButton';
import { Code } from '../Code';
import { prefFieldProps } from '../Prefs/prefField';
import { PropertyControl } from '../Properties';
import { Select, type SelectOption } from '../Select';
import { rowCondition, type TestRow } from './conditionGroups';
import { leafKey, leafOf, type ConditionLeaf } from './conditionLeaves';
import {
  clauseChoices, clausesOf, COMPARISON_LABEL, comparisonsFor, openBound, operatorOf, printOperators, rowAt, withBound, withComparison, withoutClause, withValue,
  type Comparison,
} from './conditionRows';
import s from './PrefConditionEditor.module.css';

/** What every row of one editor is drawn against. */
export interface ConditionScope {
  schema: PrefGroup | PrefSection;
  /** The schema `schema` is drawn over, which a row is checked against as well. */
  over?: PrefGroup | PrefSection;
  /** Where the condition's node sits, which a row is checked against. */
  site: PrefConditionSite;
  /** Every pref a row may read, which is how a row finds its own. */
  leaves: readonly ConditionLeaf[];
  /** The prefs a row may be pointed at. */
  prefOptions: readonly SelectOption[];
}

export interface ConditionRowProps {
  /** Names the row's controls: `Condition 2.1`. */
  name: string;
  row: TestRow;
  scope: ConditionScope;
  onChange(next: PrefCondition): void;
  onRemove(): void;
}

/** What one clause compares against, as the control its comparison takes: none for one that takes no value. */
function ValueControl({ label, row, leaf, comparison, onChange }: {
  label: string; row: TestRow; leaf: PrefLeaf; comparison: Comparison; onChange(next: TestRow): void;
}) {
  const op = operatorOf(comparison);
  if (op === undefined) return null;
  if (leaf.kind === 'number') {
    // The form's own number control: the stored number shown and typed in the leaf's unit.
    const field = prefFieldProps(leaf, {
      value: row.test[op],
      setValue: (value) => { if (typeof value === 'number' && !Number.isNaN(value)) onChange(withValue(row, comparison, value)); },
    });
    if (field?.kind === 'number') return <PropertyControl {...field} control="input" name={label} />;
  }
  const { options } = leaf as PrefEnum;
  if (op === 'in') {
    const picked = (row.test.in ?? []) as readonly string[];
    return (
      <div className={s.choices} role="group" aria-label={`${label}s`}>
        {options.map((option) => (
          <Checkbox key={option.value} isSelected={picked.includes(option.value)}
            onChange={(on) => onChange(withValue(row, comparison, on ? [...picked, option.value] : picked.filter((v) => v !== option.value)))}>
            {option.label}
          </Checkbox>
        ))}
      </div>
    );
  }
  const held = row.test[op] as string;
  return (
    <Select aria-label={label} options={options.map((o) => ({ value: o.value, label: o.label }))}
      selectedKey={options.some((o) => o.value === held) ? held : null} placeholder={`'${held}'`}
      onSelectionChange={(value) => onChange(withValue(row, comparison, value as string))} />
  );
}

/**
 * One test of a {@link PrefConditionEditor}: the pref it reads, then a comparison and its value for each operator
 * the test holds. A test the controls cannot draw keeps its pref picker and says the rest in words.
 */
export function ConditionRow({ name, row, scope, onChange, onRemove }: ConditionRowProps) {
  const { test } = row;
  const { leaves, prefOptions } = scope;
  const problems = checkPrefCondition(rowCondition(row), scope.schema, scope.site, scope.over);
  const found = leafOf(leaves, test);
  const clauses = found && clausesOf(row, found.leaf);
  const bound = found && clauses ? openBound(found.leaf, clauses) : undefined;
  const write = (next: TestRow) => onChange(rowCondition(next));
  const nth = (i: number) => (i === 0 ? '' : ` ${i + 1}`);
  const remove = <CloseButton className={s.removeRow} ariaLabel={`Remove ${name.toLowerCase()}`} onClick={onRemove} />;
  return (
    <div className={s.row} role="group" aria-label={name} data-invalid={problems.length > 0 || undefined}>
      <Select className={s.pref} aria-label={`${name} pref`} selectedKey={leafKey(test)}
        options={prefOptions.some((o) => o.value === leafKey(test)) ? prefOptions : [{ value: leafKey(test), label: found?.leaf.name || test.path }, ...prefOptions]}
        onSelectionChange={(key) => {
          const next = leaves.find((l) => leafKey(l) === key);
          if (next) write(rowAt(next, row));
        }} />
      {found && clauses?.map((comparison, i) => {
        const value = <ValueControl label={`${name} value${nth(i)}`} row={row} leaf={found.leaf} comparison={comparison} onChange={write} />;
        // A value sits beside its comparison, but for the options one of which it may be, which take a line of their own.
        const beside = operatorOf(comparison) !== undefined && operatorOf(comparison) !== 'in';
        return (
          <Fragment key={comparison}>
            {i > 0 && <span className={s.and}>and</span>}
            <Select className={beside ? s.comparison : s.comparisonAlone} aria-label={`${name} comparison${nth(i)}`} selectedKey={comparison}
              options={clauseChoices(found.leaf, clauses, i).map((c) => ({ value: c, label: COMPARISON_LABEL[c] }))}
              onSelectionChange={(next) => write(withComparison(row, found.leaf, next as Comparison, i))} />
            {beside && (
              <div className={s.value}>
                {value}
                {bound && i === clauses.length - 1 && (
                  <Button variant="ghost" size="sm" ariaLabel={`Add a bound to ${name.toLowerCase()}`} onClick={() => write(withBound(row, bound))}>and…</Button>
                )}
              </div>
            )}
            {i === 0 ? remove : <CloseButton ariaLabel={`Remove ${name.toLowerCase()} comparison ${i + 1}`} onClick={() => write(withoutClause(row, comparison))} />}
            {!beside && value}
          </Fragment>
        );
      })}
      {found && !clauses && (
        <Select className={s.comparisonAlone} aria-label={`${name} comparison`} selectedKey={null} placeholder={printOperators(test)}
          options={comparisonsFor(found.leaf).map((c) => ({ value: c, label: COMPARISON_LABEL[c] }))}
          onSelectionChange={(next) => write(withComparison(row, found.leaf, next as Comparison))} />
      )}
      {!found && <Code size="xs" emphasis="low" className={s.text}>{row.negated ? `not ${printOperators(test)}` : printOperators(test)}</Code>}
      {!clauses && remove}
      {problems.map((p, i) => <p key={i} className={s.problem}>{p.problem}</p>)}
    </div>
  );
}
