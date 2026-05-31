import type { ReactNode } from 'react';
import s from './Field.module.css';

export type FieldOrientation = 'stacked' | 'row';

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
 * Most users will instead reach for `Input` / `Checkbox` / `Switch`, which
 * compose Field internally. Use Field directly when you need a custom
 * control to sit in the same visual rhythm.
 */
export function Field({ orientation = 'stacked', className, children }: FieldProps) {
  const cls = [s.field, orientation === 'row' && s.row, className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

export const fieldClasses = {
  root: s.field,
  row: s.row,
  label: s.label,
  hint: s.hint,
  error: s.error,
};
