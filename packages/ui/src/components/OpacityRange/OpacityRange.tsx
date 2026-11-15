import type { ReactElement } from 'react';
import { InlineRange } from '../InlineRange';
import s from './OpacityRange.module.css';
import type { HoldProps } from '../Disabled';
import { useEditDraft } from '../../useEditDraft';

/** Props for {@link OpacityRange}. Alphas are 0..1 at 1% resolution. */
export interface OpacityRangeProps extends HoldProps {
  value: number;
  /** Names what the opacity belongs to; the slider is `<label> opacity`. */
  'aria-label'?: string;
  onInput?: (alpha01: number) => void;
  /** One call per drag or key step, and none for one that moved nothing. */
  onChange: (alpha01: number) => void;
  /** A drag was abandoned with Escape or an unmount, after `onInput` got its starting alpha back. */
  onCancel?: () => void;
}

/**
 * The opacity slider and its percent readout, as two inline items for the
 * caller's own row. `ColorField` puts it beside a swatch; `PaintInput` puts it
 * under a paint with no single color to carry an alpha.
 */
export function OpacityRange(props: OpacityRangeProps): ReactElement {
  const { value, disabled, disabledReason, readOnly, readOnlyReason, onInput, onChange, onCancel } = props;
  const label = props['aria-label'];
  // Drawn here rather than inside the range, so the readout follows a commit-only caller's drag too.
  const edit = useEditDraft<number>(Math.round(value * 100), {
    onInput: onInput && ((pct) => onInput(pct / 100)),
    onChange: (pct) => onChange(pct / 100),
    onCancel,
  }, Object.is);
  const pct = edit.shown;

  return (
    <>
      <InlineRange
        className={s.range}
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={disabled}
        disabledReason={disabledReason}
        readOnly={readOnly}
        readOnlyReason={readOnlyReason}
        aria-label={label ? `${label} opacity` : 'Opacity'}
        onValueInput={edit.onInput}
        onValueChange={edit.onChange}
        onValueCancel={edit.onCancel}
      />
      <span className={s.readout} aria-hidden="true">{pct}%</span>
    </>
  );
}
