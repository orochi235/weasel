import { useState } from 'react';
import type { PrefLinearUnit } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { entryScale, type UnitEntry, type UnitScale } from '@weasel-js/quantity';
import type { PrefRenderContext } from '../Prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Input } from '../Input';
import { NumberText } from './NumberText';
import s from './PrefSchemaEditor.module.css';

type Accepted = ReadonlyArray<readonly [name: string, entry: UnitEntry]>;

const nonZero = (n: number): boolean => n !== 0;
const wholeCount = (n: number): boolean => Number.isInteger(n) && n >= 0;
const named = (rows: Accepted): Accepted => rows.filter(([name]) => name !== '');
const sameRows = (a: Accepted, b: Accepted): boolean => deepEqual(a, b, { undefinedAsAbsent: true });

/** `unit` less what says nothing, and `undefined` once nothing is left of it but a scale of 1. */
function tidy({ suffix, scale, offset, accepts, precision }: PrefLinearUnit): PrefLinearUnit | undefined {
  const out: PrefLinearUnit = {
    ...(suffix ? { suffix } : {}),
    scale,
    ...(offset ? { offset } : {}),
    ...(accepts && Object.keys(accepts).length > 0 ? { accepts } : {}),
    ...(precision !== undefined ? { precision } : {}),
  };
  return scale === 1 && Object.keys(out).length === 1 ? undefined : out;
}

/**
 * A number's display unit as data: its suffix, the scale and offset that take a shown number to the stored one,
 * the places it shows, and the suffixes a person may type in its place. A row for a suffix not yet named is held
 * here and written once it has a name.
 */
export function UnitEditor({ ctx }: { ctx: PrefRenderContext }) {
  const unit = (ctx.value as PrefLinearUnit | undefined) ?? { scale: 1 };
  const write = (patch: Partial<PrefLinearUnit>) => ctx.setValue(tidy({ ...unit, ...patch }));
  const held: Accepted = Object.entries(unit.accepts ?? {});
  const [rows, setRows] = useState(held);
  if (!sameRows(named(rows), held)) setRows(held);
  const setAccepted = (next: Accepted) => {
    setRows(next);
    write({ accepts: Object.fromEntries(named(next)) });
  };
  const rename = (i: number, name: string) => {
    if (name !== '' && rows.some(([other], j) => j !== i && other === name)) return;
    // `52` would read as 5 of a unit named `2`, and an all-digit key leaves its place in the object's order.
    if (/^\d/.test(name)) return;
    setAccepted(rows.map((row, j) => (j === i ? [name, row[1]] : row)));
  };
  const rescale = (i: number, patch: Partial<Required<UnitScale>>) => {
    const next = { ...entryScale(rows[i]![1]), ...patch };
    setAccepted(rows.map((row, j) => (j === i ? [row[0], next.offset === 0 ? next.factor : next] : row)));
  };
  return (
    <div className={s.options}>
      <div className={`${s.unitRow} ${s.optionHeads}`} aria-hidden="true">
        <span>Suffix</span>
        <span>Scale</span>
        <span>Offset</span>
        <span>Places</span>
      </div>
      <div className={s.unitRow}>
        <Input aria-label="Unit suffix" value={unit.suffix ?? ''} onChange={(suffix) => write({ suffix })} />
        <NumberText label="Unit scale" value={unit.scale} accept={nonZero} onCommit={(n) => write({ scale: n ?? 1 })} />
        <NumberText label="Unit offset" value={unit.offset} onCommit={(offset) => write({ offset })} />
        <NumberText label="Unit places" value={unit.precision} accept={wholeCount} onCommit={(precision) => write({ precision })} />
      </div>
      {rows.length > 0 && (
        <div className={`${s.acceptRow} ${s.optionHeads}`} aria-hidden="true">
          <span>Also typed as</span>
          <span>Scale</span>
          <span>Offset</span>
          <span className={s.optionHeadSpacer} />
        </div>
      )}
      {rows.map(([name, entry], i) => {
        const { factor, offset } = entryScale(entry);
        const label = `Accepted suffix ${i + 1}`;
        return (
          <div key={i} className={s.acceptRow}>
            <Input aria-label={label} value={name} onChange={(v) => rename(i, v)} />
            <NumberText label={`${label} scale`} value={factor} accept={nonZero} onCommit={(n) => rescale(i, { factor: n ?? 1 })} />
            <NumberText label={`${label} offset`} value={offset === 0 ? undefined : offset} onCommit={(n) => rescale(i, { offset: n ?? 0 })} />
            <CloseButton ariaLabel={`Remove accepted suffix ${i + 1}`} onClick={() => setAccepted(rows.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <Button size="sm" onClick={() => setRows([...rows, ['', 1]])}>Add accepted suffix</Button>
    </div>
  );
}
