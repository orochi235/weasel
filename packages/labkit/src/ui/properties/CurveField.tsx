import { useCallback, useMemo } from 'react';
import { type ControlPoint, CurveEditor, dlog } from '../../passthrough/weasel-ui';

export interface CurveFieldProps {
  /** Flat [x0, y0, x1, y1, …] — matches how curve-as-array configs
   *  serialize in JSON snapshots. */
  values: number[];
  min: number;
  max: number;
  step: number;
  /** Plot width in CSS px. Caller sizes (typically uses a ResizeObserver). */
  width: number;
  /** Plot height in CSS px. Default 110. */
  height?: number;
  /** Flat default curve. When provided, a Reset button restores it. */
  defaults?: readonly number[];
  onChange: (next: number[]) => void;
}

/**
 * A function-domain (y = f(x), x ∈ [0,1]) curve editor with per-stop
 * numeric readouts and a flip-horizontally button. Wraps weasel-ui's
 * `CurveEditor`; consumers wanting the raw editor (2D paths,
 * custom anchors) should import it from `@labkit/react/weasel-ui`.
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
}: CurveFieldProps) {
  const points: ControlPoint[] = useMemo(() => {
    const out: ControlPoint[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) out.push({ x: values[i]!, y: values[i + 1]! });
    return out;
  }, [values]);

  const handleChange = useCallback(
    (next: ControlPoint[]) => {
      const flat: number[] = new Array(next.length * 2);
      for (let i = 0; i < next.length; i++) {
        const ySnap = Math.round(next[i]!.y / step) * step;
        const y = Math.max(min, Math.min(max, ySnap));
        flat[i * 2] = next[i]!.x;
        flat[i * 2 + 1] = y;
      }
      dlog('curve-field', 'handleChange', { nLen: next.length, flatLen: flat.length, sample: flat.slice(0, 4) });
      onChange(flat);
    },
    [onChange, min, max, step],
  );

  const handleFlip = useCallback(() => {
    const flipped: Array<{ x: number; y: number }> = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      flipped.push({ x: 1 - values[i]!, y: values[i + 1]! });
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
      flipped[i] = values[i]!;
      flipped[i + 1] = 2 * mid - values[i + 1]!;
    }
    onChange(flipped);
  }, [values, min, max, onChange]);

  return (
    <div className="lk-curve-field">
      <div className="lk-curve-field__plot">
        <CurveEditor
          value={points}
          onChange={handleChange}
          domain="1d"
          constrain="function"
          xRange={[0, 1]}
          yRange={[min, max]}
          width={width}
          height={height}
          endpoints="pinned-x"
          addPointMode="click-curve"
          minPoints={2}
          grid={{}}
          history={false}
        />
      </div>
      <div className="lk-curve-field__actions">
        <button type="button" className="lk-curve-field__action" onClick={handleFlip}>
          Flip horizontally
        </button>
        <button type="button" className="lk-curve-field__action" onClick={handleFlipVertical}>
          Flip vertically
        </button>
        {defaults && (
          <button
            type="button"
            className="lk-curve-field__action"
            onClick={() => onChange([...defaults])}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
