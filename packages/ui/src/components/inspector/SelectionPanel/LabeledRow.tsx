import { type ReactElement, type ReactNode, useMemo } from 'react';
import { holdScope, useDisabled, type DisableableProps } from '../../Disabled';
import { ReasonTold } from '../../Disabled/Disabled';
import { HiddenBadge } from '../../Prefs/hidden';
import { ResetControl } from '../../Properties/ResetControl';
import { InsideRow, useRowState } from '../../Properties/rowScope';
import s from './SelectionPanel.module.css';

/** Props for {@link LabeledRow}. Its reset comes from the `<RowScope>` around it. */
export interface LabeledRowProps extends DisableableProps {
  label: ReactNode;
  /** The label's tooltip. */
  title?: string;
  /** The row carries its own hidden mark, drawn as a badge after the label. */
  marked: boolean;
  /** The selection and hidden attributes the row's element carries. */
  attrs: Record<string, string | undefined>;
  children: ReactNode;
}

/** A panel row: its label in the label column, its controls beside it. Disabled, its reason is read after `title`
 *  in the label's tooltip. */
export function LabeledRow(props: LabeledRowProps): ReactElement {
  const { label, title, marked, attrs, children } = props;
  const { disabled, reason: why } = useDisabled(props);
  const state = useRowState();
  const { onReset } = state;
  const scope = useMemo(() => ({ ...state, label }), [state, label]);
  return (
    <div className={s.row} {...attrs} {...(disabled ? { 'data-disabled': '' } : {})}>
      <span className={s.rowLabel} title={why ? (title ? `${title}\n${why}` : why) : title}>{label}{marked && <HiddenBadge />}{onReset && <ResetControl name={typeof label === 'string' ? label : 'this setting'} onReset={onReset} disabled={disabled} />}</span>
      <span className={s.rowControls}>
        <InsideRow scope={scope}><ReasonTold reason={why}>{holdScope(props, children)}</ReasonTold></InsideRow>
      </span>
    </div>
  );
}
