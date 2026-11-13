import type { ReactElement, ReactNode } from 'react';
import { HiddenBadge } from '../Prefs/hidden';
import { ResetControl } from '../Properties/ResetControl';
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
  /** Why the row is disabled, read after `title` in the label's tooltip while it is. */
  disabledReason?: string;
  /** Given, a `ResetControl` after the label calls it. */
  onReset?: () => void;
  /** The selection and hidden attributes the row's element carries. */
  attrs: Record<string, string | undefined>;
  children: ReactNode;
}

/** A panel row: its label in the label column, its controls beside it. */
export function LabeledRow({ label, title, marked, disabled, disabledReason, onReset, attrs, children }: LabeledRowProps): ReactElement {
  const why = disabled ? disabledReason : undefined;
  return (
    <div className={s.row} {...attrs} {...(disabled ? { 'data-disabled': '' } : {})}>
      <span className={s.rowLabel} title={why ? (title ? `${title}\n${why}` : why) : title}>{label}{marked && <HiddenBadge />}{onReset && <ResetControl name={typeof label === 'string' ? label : 'this setting'} onReset={onReset} />}</span>
      <span className={s.rowControls}>{children}</span>
    </div>
  );
}
