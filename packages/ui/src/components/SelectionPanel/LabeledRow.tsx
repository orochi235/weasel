import type { ReactElement, ReactNode } from 'react';
import { HiddenBadge } from '../Prefs/hidden';
import s from './SelectionPanel.module.css';

/** Props for {@link LabeledRow}. */
export interface LabeledRowProps {
  label: ReactNode;
  /** The label's tooltip. */
  title?: string;
  /** The row carries its own hidden mark, drawn as a badge after the label. */
  marked: boolean;
  /** Every control in the row is disabled. */
  disabled: boolean;
  /** The selection and hidden attributes the row's element carries. */
  attrs: Record<string, string | undefined>;
  children: ReactNode;
}

/** A panel row: its label in the label column, its controls beside it. */
export function LabeledRow({ label, title, marked, disabled, attrs, children }: LabeledRowProps): ReactElement {
  return (
    <div className={s.row} {...attrs} {...(disabled ? { 'data-disabled': '' } : {})}>
      <span className={s.rowLabel} title={title}>{label}{marked && <HiddenBadge />}</span>
      <span className={s.rowControls}>{children}</span>
    </div>
  );
}
