import { useElementSize } from '@weasel-js/core';
import { useCallback, useMemo, useRef } from 'react';
import { dlog } from '../../dlog';
import { type ControlPoint, CurveEditor } from '../CurveEditor';
import { CurveMarks, type CurveMark } from './CurveMarks';
import s from './CurveField.module.css';
import { useControlAccess, type HoldProps } from '../Disabled';

export type { CurveMark } from './CurveMarks';

/** Props for `<CurveField>`. */
export interface CurveFieldProps extends HoldProps {
  /** Flat [x0, y0, x1, y1, …] — matches how curve-as-array configs
   *  serialize in JSON snapshots. */
  values: number[];
  min: number;
  max: number;
  step: number;
  /** Plot width in CSS px. Default: the width the field is laid out at. */
  width?: number;
  /** Plot height in CSS px. Default 110. */
  height?: number;
  /** Flat default curve. When provided, a Reset button restores it. */
  defaults?: readonly number[];
  /** A finished edit: the curve a drag settles on, a flip, a reset. Without `onInput`, every move of a drag too. */
  onChange: (next: number[]) => void;
  /** Every move of a drag. Given, `onChange` hears only the curve the drag settles on, once. */
  onInput?: (next: number[]) => void;
  /** Optional vertical marks overlaid on the plot (e.g. landmarks). */
  marks?: readonly CurveMark[];
}

/**
 * A function-domain (y = f(x), x ∈ [0,1]) curve editor with per-stop
 * numeric readouts and flip buttons. Wraps weasel-ui's
 * `CurveEditor`; consumers wanting the raw editor (2D paths,
 * custom anchors) should import that instead.
 */
export function CurveField({
  values,
  min,
  max,
  step,
  width,
  height = 110,
  defaults,
  onChange,
  onInput,
  marks,
  ...own
}: CurveFieldProps) {
  // Disabled or read-only, the plot ignores the pointer and the buttons are disabled.
  const access = useControlAccess(own);
  const disabled = access.state !== 'enabled';
  const host = useRef<HTMLDivElement>(null);
  const measured = useElementSize(host);
  const plotWidth = width ?? measured.width;
  const points: ControlPoint[] = useMemo(() => {
    const out: ControlPoint[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) out.push({ x: values[i], y: values[i + 1] });
    return out;
  }, [values]);

  const snapped = useCallback(
    (next: readonly ControlPoint[]): number[] => {
      const flat: number[] = new Array(next.length * 2);
      for (let i = 0; i < next.length; i++) {
        const ySnap = Math.round(next[i].y / step) * step;
        const y = Math.max(min, Math.min(max, ySnap));
        flat[i * 2] = next[i].x;
        flat[i * 2 + 1] = y;
      }
      dlog('curve-field', 'snapped', { nLen: next.length, flatLen: flat.length, sample: flat.slice(0, 4) });
      return flat;
    },
    [min, max, step],
  );
  const handleInput = useCallback(
    (next: ControlPoint[]) => (onInput ?? onChange)(snapped(next)),
    [onInput, onChange, snapped],
  );
  const handleSettled = useCallback(
    (next: ControlPoint[]) => {
      if (onInput) onChange(snapped(next));
    },
    [onInput, onChange, snapped],
  );

  const handleFlip = useCallback(() => {
    const flipped: Array<{ x: number; y: number }> = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      flipped.push({ x: 1 - values[i], y: values[i + 1] });
    }
    flipped.sort((a, b) => a.x - b.x);
    const out: number[] = [];
    for (const p of flipped) out.push(p.x, p.y);
    onChange(out);
  }, [values, onChange]);

  const handleFlipVertical = useCallback(() => {
    const mid = (min + max) / 2;
    const flipped: number[] = new Array(values.length);
    for (let i = 0; i + 1 < values.length; i += 2) {
      flipped[i] = values[i];
      flipped[i + 1] = 2 * mid - values[i + 1];
    }
    onChange(flipped);
  }, [values, min, max, onChange]);

  return (
    <div ref={host} className={disabled ? `${s.field} ${s.disabled}` : s.field} aria-disabled={disabled || undefined}>
      <div className={s.plot}>
        <CurveEditor
          value={points}
          onInput={handleInput}
          onChange={handleSettled}
          domain="1d"
          constrain="function"
          xRange={[0, 1]}
          yRange={[min, max]}
          width={plotWidth}
          height={height}
          endpoints="pinned-x"
          addPointMode="click-curve"
          minPoints={2}
          grid={{}}
          history={false}
        />
        {marks && marks.length > 0 && <CurveMarks marks={marks} width={plotWidth} height={height} />}
      </div>
      <div className={s.actions}>
        <button type="button" className={s.action} onClick={handleFlip} disabled={disabled}>
          Flip horizontally
        </button>
        <button type="button" className={s.action} onClick={handleFlipVertical} disabled={disabled}>
          Flip vertically
        </button>
        {defaults && (
          <button
            type="button"
            className={s.action}
            onClick={() => onChange([...defaults])}
            disabled={disabled}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
