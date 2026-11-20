import { Fragment } from 'react';
import {
  checkPrefCondition, type PrefCondition, prefConditionInGroup, type PrefConditionSite, type PrefEnum, type PrefGroup,
  type PrefLeaf, type PrefSection, type PrefTest,
} from '@weasel-js/prefs';
import {
  Button, CheckboxGroup, CLOSE_BUTTON_PROPS, Code, type ListOption, prefFieldProps, PropertyControl, Select,
} from '@weasel-js/ui';
import {
  clauseChoices, clausesOf, type Comparison, COMPARISON_LABEL, comparisonsFor, type ConditionLeaf, leafKey,
  conditionLeafOf, openBound, operatorOf, printOperators, rowAt, rowCondition, type TestRow, withBound,
  withComparison, withoutClause, withValue,
} from '@weasel-js/prefs/edit';
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
  prefOptions: readonly ListOption[];
}

/**
 * The leaf `test` reads, and the test as read from the schema root: one read from its group (`from: 'group'`) reads
 * the root at the group's path, where the editor is told it.
 */
export function rowLeaf(scope: ConditionScope, test: PrefTest): { read: PrefTest; found: ConditionLeaf | undefined } {
  const { group } = scope.site;
  const read = group === undefined ? test : prefConditionInGroup(test, group) as PrefTest;
  return { read, found: conditionLeafOf(scope.leaves, read) };
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
      <div className={s.choices}>
        <CheckboxGroup aria-label={`${label}s`} orientation="horizontal" sweep
          items={options.map((option) => ({ value: option.value, label: option.label }))}
          value={picked} onChange={(next) => onChange(withValue(row, comparison, next))} />
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
  const { read, found } = rowLeaf(scope, test);
  // The controls draw a test read from its group as the root's, and write it back read from the group.
  const drawn: TestRow = read === test ? row : { ...row, test: read };
  const clauses = found && clausesOf(drawn, found.leaf);
  const bound = found && clauses ? openBound(found.leaf, clauses) : undefined;
  const repoint = (next: TestRow) => onChange(rowCondition(next));
  const write = (next: TestRow) => repoint(read === test ? next : { ...next, test: { ...next.test, from: test.from, path: test.path } });
  const named = found?.leaf.name || test.path;
  const where = test.from === 'group' ? `this group: ${test.path}` : test.from === 'item' ? `this entry: ${test.path}` : test.path;
  const nth = (i: number) => (i === 0 ? '' : ` ${i + 1}`);
  const remove = <Button {...CLOSE_BUTTON_PROPS} className={s.removeRow} aria-label={`Remove ${name.toLowerCase()}`} onClick={onRemove} />;
  return (
    <div className={s.row} role="group" aria-label={name} data-invalid={problems.length > 0 || undefined}>
      <Select className={s.pref} aria-label={`${name} pref`} selectedKey={leafKey(test)}
        options={prefOptions.some((o) => o.value === leafKey(test)) ? prefOptions : [{ value: leafKey(test), label: <>{named} <span className={s.path}>{where}</span></>, textValue: `${named} ${where}` }, ...prefOptions]}
        onSelectionChange={(key) => {
          const next = leaves.find((l) => leafKey(l) === key);
          if (next) repoint(rowAt(next, row));
        }} />
      {found && clauses?.map((comparison, i) => {
        const value = <ValueControl label={`${name} value${nth(i)}`} row={drawn} leaf={found.leaf} comparison={comparison} onChange={write} />;
        // A value sits beside its comparison, but for the options one of which it may be, which take a line of their own.
        const beside = operatorOf(comparison) !== undefined && operatorOf(comparison) !== 'in';
        return (
          <Fragment key={comparison}>
            {i > 0 && <span className={s.and}>and</span>}
            <Select className={beside ? s.comparison : s.comparisonAlone} aria-label={`${name} comparison${nth(i)}`} selectedKey={comparison}
              options={clauseChoices(found.leaf, clauses, i).map((c) => ({ value: c, label: COMPARISON_LABEL[c] }))}
              onSelectionChange={(next) => write(withComparison(drawn, found.leaf, next as Comparison, i))} />
            {beside && (
              <div className={s.value}>
                {value}
                {bound && i === clauses.length - 1 && (
                  <Button variant="ghost" size="sm" aria-label={`Add a bound to ${name.toLowerCase()}`} onClick={() => write(withBound(drawn, bound))}>and…</Button>
                )}
              </div>
            )}
            {i === 0 ? remove : <Button {...CLOSE_BUTTON_PROPS} aria-label={`Remove ${name.toLowerCase()} comparison ${i + 1}`} onClick={() => write(withoutClause(drawn, comparison))} />}
            {!beside && value}
          </Fragment>
        );
      })}
      {found && !clauses && (
        <Select className={s.comparisonAlone} aria-label={`${name} comparison`} selectedKey={null} placeholder={printOperators(test)}
          options={comparisonsFor(found.leaf).map((c) => ({ value: c, label: COMPARISON_LABEL[c] }))}
          onSelectionChange={(next) => write(withComparison(drawn, found.leaf, next as Comparison))} />
      )}
      {!found && <Code size="xs" emphasis="low" className={s.text}>{row.negated ? `not ${printOperators(test)}` : printOperators(test)}</Code>}
      {!clauses && remove}
      {problems.map((p, i) => <p key={i} className={s.problem}>{p.problem}</p>)}
    </div>
  );
}
