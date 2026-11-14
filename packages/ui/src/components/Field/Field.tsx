import { useId, type ReactNode } from 'react';
import s from './Field.module.css';

/**
 * Whether a {@link Field} stacks its label above the control or sits them
 * side by side.
 */
export type FieldOrientation = 'stacked' | 'row';

/** Props for {@link Field}. */
export type FieldProps = {
  orientation?: FieldOrientation;
  /** Names the field, and the group its control sits in. */
  label?: ReactNode;
  /** The control's current value as it should read beside the label; equal-width digits. */
  output?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/**
 * Layout primitive that arranges a label, control, hint, and error in the
 * canonical weasel-ui form-row shape. The control itself owns its semantics
 * (RAC `TextField`, `Checkbox`, etc.); this just paints the layout.
 *
 * Given a `label`, it draws it and becomes a group named by it; given an
 * `output`, it shows that value at the end of the label's line, or after the
 * control in a `row`. So any control gets a label-and-value header:
 *
 * ```tsx
 * <Field label="Opacity" output={`${v}%`}><Slider aria-label="Opacity" … /></Field>
 * ```
 *
 * `Input`, `Checkbox`, and `Switch` lay themselves out and do not render
 * Field. Use it when a custom control needs to sit in the same visual rhythm;
 * `RadioGroup` reads {@link fieldClasses} for the same purpose.
 */
export function Field({ orientation = 'stacked', label, output, className, children }: FieldProps) {
  const labelId = useId();
  const cls = [s.field, orientation === 'row' && s.row, className].filter(Boolean).join(' ');
  const named = label !== undefined;
  const labelEl = named && <span id={labelId} className={s.label}>{label}</span>;
  // The control announces its own value; a live region here would say it twice through a drag.
  const outputEl = output !== undefined && <output aria-live="off" className={s.output}>{output}</output>;
  const group = named ? { role: 'group', 'aria-labelledby': labelId } : {};
  if (orientation === 'row') {
    return <div className={cls} {...group}>{labelEl}{children}{outputEl}</div>;
  }
  return (
    <div className={cls} {...group}>
      {(labelEl || outputEl) && <div className={s.head}>{labelEl}{outputEl}</div>}
      {children}
    </div>
  );
}

/**
 * The class names {@link Field} paints its slots with, so a control composing
 * its own layout can match the same form-row rhythm.
 */
export const fieldClasses = {
  root: s.field,
  row: s.row,
  label: s.label,
  hint: s.hint,
  error: s.error,
};
