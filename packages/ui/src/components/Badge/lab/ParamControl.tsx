import type { ReactElement, ReactNode } from 'react';
import { ToggleBar } from '../../ToggleBar/ToggleBar';
import { InlineRange } from '../../InlineRange';
import type { ShapeControl } from '../shapeControls';
import s from './controls.stories.module.css';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The kit's segmented control over a fixed list of strings, which the lab never deselects. */
export function LabToggle<T extends string>({ value, options, labels, onChange }: {
  value: T;
  options: readonly T[];
  labels?: readonly string[];
  onChange: (value: T) => void;
}): ReactElement {
  return (
    <ToggleBar<T>
      items={options.map((option, i) => ({ value: option, label: labels?.[i] ?? option }))}
      value={value}
      onChange={(next) => { if (next != null) onChange(next); }}
      size="sm"
    />
  );
}

/** A labeled row: the label, then whatever controls fill the rest of `columns`. */
export function Field({ label, columns, children }: { label: string; columns: string; children: ReactNode }) {
  return (
    <label className={`${s.row} ${columns}`}>
      <span className={s.label}>{label}</span>
      {children}
    </label>
  );
}

/** A labeled range input with its value read out in the row's last cell. */
export function RangeRow({ label, value, min, max, step, onChange, narrow, readout }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  narrow?: boolean;
  readout?: string;
}) {
  return (
    <Field label={label} columns={narrow ? s.narrow3 : s.wide3}>
      <InlineRange className={s.fill} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className={s.label}>{readout ?? value}</span>
    </Field>
  );
}

function ControlInput({ control, value, onChange, dense }: {
  control: Exclude<ShapeControl, { kind: 'header' }>;
  value: number | string;
  onChange: (value: number | string) => void;
  dense: boolean;
}) {
  switch (control.kind) {
    case 'range':
      return (
        <>
          <InlineRange className={s.fill} min={control.min} max={control.max} step={control.step} value={value as number} onChange={(e) => onChange(Number(e.target.value))} />
          <span className={s.label}>{value}</span>
        </>
      );
    case 'select':
      return (
        <>
          {dense ? (
            <select className={s.select} value={value as string} onChange={(e) => onChange(e.target.value)}>
              {control.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <LabToggle value={value as string} options={control.options} onChange={onChange} />
          )}
          <span />
        </>
      );
    case 'color':
      return (
        <>
          <input type="color" className={s.swatch} value={typeof value === 'string' && HEX.test(value) ? value : control.default} onChange={(e) => onChange(e.target.value)} />
          <span className={s.label}>{value}</span>
        </>
      );
    case 'text':
      return (
        <>
          <input type="text" className={s.text} value={value as string} onChange={(e) => onChange(e.target.value)} />
          <span />
        </>
      );
  }
}

/**
 * One row of a control list: a section header, or a labeled input for the
 * control's kind. `dense` is the shape gallery's card, which is narrower and
 * picks an option from a native select.
 */
export function ParamControl({ control, value, onChange, dense = false }: {
  control: ShapeControl;
  value: number | string;
  onChange: (value: number | string) => void;
  dense?: boolean;
}) {
  const density = dense ? ` ${s.dense}` : '';
  if (control.kind === 'header') return <div className={`${s.header}${density}`}>{control.label}</div>;
  return (
    <label className={`${s.row} ${s.wide3}${density}`}>
      <span className={s.label}>{control.key}</span>
      <ControlInput control={control} value={value} onChange={onChange} dense={dense} />
    </label>
  );
}
