import { useElementSize } from '@weasel-js/routing/react';
import { useCallback, useMemo, useRef } from 'react';
import { snapToStep } from '@weasel-js/quantity';
import { dlog } from '../../dlog';
import { type ControlPoint, CurveEditor } from '../CurveEditor';
import { CurveMarks, type CurveMark } from './CurveMarks';
import s from './CurveField.module.css';
import { useControlAccess, type HoldProps } from '../Disabled';
import { ownHold } from '../Disabled/controlHold';
import { useFieldControl } from '../Field/fieldSemantics';
import { useNameText } from './nameOf';

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
  /** The kit's edit protocol (`docs/conventions.md`, "Edit callbacks"): a drag, a flip and a reset are each one
   *  edit. Escape cancels a drag. */
  onChange: (next: number[]) => void;
  onInput?: (next: number[]) => void;
  onCancel?: () => void;
  /** Optional vertical marks overlaid on the plot (e.g. landmarks). */
  marks?: readonly CurveMark[];
  /** The field's accessible name: its plot's, and the group's holding its buttons. Omitted, a field in a row is
   *  named by the row's label. */
  'aria-label'?: string;
}

function toPoints(flat: readonly number[]): ControlPoint[] {
  const out: ControlPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
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
  onCancel,
  marks,
  'aria-label': ariaLabel,
  ...own
}: CurveFieldProps) {
  const text = useNameText(ariaLabel);
  const { id: _id, ...named } = useFieldControl({ 'aria-label': ariaLabel });
  // Disabled or read-only, the plot holds itself and the buttons are disabled.
  const access = useControlAccess(own);
  const disabled = access.state !== 'enabled';
  const host = useRef<HTMLDivElement>(null);
  const measured = useElementSize(host);
  const plotWidth = width ?? measured.width;
  const points = useMemo(() => toPoints(values), [values]);

  const snapped = useCallback(
    (next: readonly ControlPoint[]): number[] => {
      const flat: number[] = new Array(next.length * 2);
      for (let i = 0; i < next.length; i++) {
        const y = Math.max(min, Math.min(max, snapToStep(next[i].y, step, min)));
        flat[i * 2] = next[i].x;
        flat[i * 2 + 1] = y;
      }
      dlog('curve-field', 'snapped', { nLen: next.length, flatLen: flat.length, sample: flat.slice(0, 4) });
      return flat;
    },
    [min, max, step],
  );
  const handleInput = useCallback((next: ControlPoint[]) => onInput?.(snapped(next)), [onInput, snapped]);
  const handleSettled = useCallback((next: ControlPoint[]) => onChange(snapped(next)), [onChange, snapped]);

  // A flip and a reset are edits like a drag, and land on the same grid.
  const handleFlip = useCallback(() => {
    const flipped = points.map((p) => ({ x: 1 - p.x, y: p.y })).sort((a, b) => a.x - b.x);
    onChange(snapped(flipped));
  }, [points, snapped, onChange]);

  const handleFlipVertical = useCallback(() => {
    onChange(snapped(points.map((p) => ({ x: p.x, y: min + max - p.y }))));
  }, [points, min, max, snapped, onChange]);

  const handleReset = useCallback(() => {
    if (defaults) onChange(snapped(toPoints(defaults)));
  }, [defaults, snapped, onChange]);

  return (
    <div ref={host} className={s.field} role="group" {...named}>
      <div className={s.plot}>
        <CurveEditor
          {...ownHold(own)}
          aria-label={text}
          value={points}
          onInput={handleInput}
          onChange={handleSettled}
          onCancel={onCancel}
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
            onClick={handleReset}
            disabled={disabled}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
