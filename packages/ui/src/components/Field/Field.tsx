import type { ReactNode } from 'react';
import s from '../field.module.css';

/**
 * Whether a {@link Field} stacks its label above the control or sits them
 * side by side.
 */
export type FieldOrientation = 'stacked' | 'row';

/** Props for {@link Field}. */
export type FieldProps = {
  orientation?: FieldOrientation;
  className?: string;
  children?: ReactNode;
};

/**
 * Layout primitive that arranges a label, control, hint, and error in the
 * canonical weasel-ui form-row shape. The control itself owns its semantics
 * (RAC `TextField`, `Checkbox`, etc.); this just paints the layout.
 *
 * `Input`, `Checkbox`, and `Switch` lay themselves out and do not render
 * Field. Use it when a custom control needs to sit in the same visual rhythm;
 * `RadioGroup` reads {@link fieldClasses} for the same purpose.
 */
export function Field({ orientation = 'stacked', className, children }: FieldProps) {
  const cls = [s.field, orientation === 'row' && s.row, className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
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
