import { NumberField, Slider } from '../passthrough/weasel-ui';

/** Props for `<ZoomControl>`. */
export interface ZoomControlProps {
  /** Current zoom as a scale factor: 1 is actual size. */
  zoom: number;
  /** Fired continuously while the slider drags. */
  onZoomChange: (zoom: number) => void;
  /** Fired when a drag settles or the field is committed. Defaults to
   *  `onZoomChange`. */
  onZoomCommit?: (zoom: number) => void;
  /** Smallest selectable zoom. Defaults to 0.1 (10%). */
  min?: number;
  /** Largest selectable zoom. Defaults to 8 (800%). */
  max?: number;
  className?: string;
}

// Zoom is perceptually geometric — halving is as big a step as doubling — so
// the slider runs on log2 and 100% lands mid-track for a symmetric range.
const toTrack = (zoom: number): number => Math.log2(zoom);
const fromTrack = (v: number): number => 2 ** v;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Zoom as a log-scaled slider with an editable percentage beside it. Pair it
 *  with zoom-in / zoom-out buttons in a `<Toolbar.Group>`; this component owns
 *  only the continuous part. */
export function ZoomControl({
  zoom,
  onZoomChange,
  onZoomCommit,
  min = 0.1,
  max = 8,
  className,
}: ZoomControlProps) {
  const commit = onZoomCommit ?? onZoomChange;
  const emit = (track: number, done: boolean): void => {
    const next = clamp(fromTrack(track), min, max);
    (done ? commit : onZoomChange)(next);
  };

  return (
    <div className={`lk-zoom${className ? ` ${className}` : ''}`}>
      <Slider
        className="lk-zoom__slider"
        ariaLabel="Zoom"
        min={toTrack(min)}
        max={toTrack(max)}
        // Detents at the octaves plus actual size, so 25/50/100/200/400% are
        // reachable by drag rather than only by typing.
        stops={[-2, -1, 0, 1, 2]}
        thumbs={[{ value: clamp(toTrack(zoom), toTrack(min), toTrack(max)) }]}
        onInput={(next) => emit(next[0].value, false)}
        onChange={(next) => emit(next[0].value, true)}
        readoutPlacement="none"
      />
      {/* `style: 'percent'` formats a fraction, so the field carries the scale
          factor itself and renders 0.5 as "50%". */}
      <NumberField
        className="lk-zoom__field"
        aria-label="Zoom"
        value={zoom}
        minValue={min}
        maxValue={max}
        step={0.01}
        hideSteppers
        formatOptions={{ style: 'percent', maximumFractionDigits: 0 }}
        onChange={(next) => {
          if (!Number.isFinite(next)) return;
          commit(clamp(next, min, max));
        }}
      />
    </div>
  );
}
