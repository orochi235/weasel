import { checkPrefCondition, type PrefCondition, type PrefEnum, type PrefGroup, type PrefSection, type PrefTest } from '@weasel-js/prefs';
import { Checkbox } from '../Checkbox';
import { CloseButton } from '../CloseButton';
import { Code } from '../Code';
import { prefFieldProps } from '../Prefs/prefField';
import { PropertyControl } from '../Properties';
import { Select, type SelectOption } from '../Select';
import {
  COMPARISON_LABEL, comparisonOf, comparisonsFor, isTest, printCondition, printOperators, testOf, withComparison,
  type Comparison, type ConditionLeaf,
} from './conditionRows';
import s from './PrefConditionEditor.module.css';

export interface ConditionRowProps {
  /** The row's place among its siblings, from 1, which names its controls. */
  n: number;
  part: PrefCondition;
  schema: PrefGroup | PrefSection;
  /** Every pref a row may read, which is how the row finds its own. */
  leaves: readonly ConditionLeaf[];
  /** The prefs the row may be pointed at. */
  prefOptions: readonly SelectOption[];
  onChange(next: PrefCondition): void;
  onRemove(): void;
}

/** What a test compares against, as the control its comparison takes: none for a boolean or a bare test. */
function ValueControl({ n, test, found, comparison, onChange }: {
  n: number; test: PrefTest; found: ConditionLeaf; comparison: Comparison; onChange(next: PrefTest): void;
}) {
  const { path } = test;
  if (comparison === 'on' || comparison === 'off' || comparison === 'set') return null;
  if (found.leaf.kind === 'number' && comparison !== 'in') {
    // The form's own number control: the stored number shown and typed in the leaf's unit.
    const field = prefFieldProps(found.leaf, {
      value: test[comparison],
      setValue: (value) => { if (typeof value === 'number' && !Number.isNaN(value)) onChange({ path, [comparison]: value }); },
    });
    if (field !== null) return <PropertyControl {...field} control="input" name={`Condition ${n} value`} className={s.value} />;
  }
  const { options } = found.leaf as PrefEnum;
  if (comparison === 'in') {
    const picked = (test.in ?? []) as readonly string[];
    return (
      <div className={s.choices} role="group" aria-label={`Condition ${n} values`}>
        {options.map((option) => (
          <Checkbox key={option.value} isSelected={picked.includes(option.value)}
            onChange={(on) => onChange({ path, in: on ? [...picked, option.value] : picked.filter((v) => v !== option.value) })}>
            {option.label}
          </Checkbox>
        ))}
      </div>
    );
  }
  const held = test[comparison] as string;
  return (
    <Select className={s.value} aria-label={`Condition ${n} value`} options={options.map((o) => ({ value: o.value, label: o.label }))}
      selectedKey={options.some((o) => o.value === held) ? held : null} placeholder={`'${held}'`}
      onSelectionChange={(value) => onChange({ path, [comparison]: value })} />
  );
}

/** One row of a {@link PrefConditionEditor}: a test as its three controls, or any other condition as text. */
export function ConditionRow({ n, part, schema, leaves, prefOptions, onChange, onRemove }: ConditionRowProps) {
  const problems = checkPrefCondition(part, schema);
  const found = isTest(part) ? leaves.find((l) => l.path === part.path) : undefined;
  const comparison = isTest(part) && found ? comparisonOf(part, found.leaf) : undefined;
  return (
    <div className={s.row} role="group" aria-label={`Condition ${n}`} data-invalid={problems.length > 0 || undefined}>
      {isTest(part) ? (
        <div className={s.controls}>
          <Select className={s.pref} aria-label={`Condition ${n} pref`} selectedKey={part.path}
            options={prefOptions.some((o) => o.value === part.path) ? prefOptions : [{ value: part.path, label: found?.leaf.name || part.path }, ...prefOptions]}
            onSelectionChange={(path) => {
              const next = leaves.find((l) => l.path === path);
              if (next) onChange(testOf(next.path, next.leaf, part));
            }} />
          {found ? (
            <Select className={s.comparison} aria-label={`Condition ${n} comparison`} selectedKey={comparison ?? null}
              placeholder={printOperators(part)}
              options={comparisonsFor(found.leaf).map((c) => ({ value: c, label: COMPARISON_LABEL[c] }))}
              onSelectionChange={(next) => onChange(withComparison(part, found.leaf, next))} />
          ) : <Code size="xs" status="muted" className={s.text}>{printOperators(part)}</Code>}
          {found && comparison && <ValueControl n={n} test={part} found={found} comparison={comparison} onChange={onChange} />}
        </div>
      ) : <Code size="xs" status="muted" className={s.text}>{printCondition(part)}</Code>}
      <CloseButton ariaLabel={`Remove condition ${n}`} onClick={onRemove} />
      {problems.map((p, i) => <p key={i} className={s.problem}>{p.problem}</p>)}
    </div>
  );
}
