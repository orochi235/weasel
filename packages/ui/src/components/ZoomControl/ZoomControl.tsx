import { clamp, normalizeZoom } from '@weasel-js/geom';
import { NumberField } from '../NumberField';
import { Slider } from '../Slider';
import s from './ZoomControl.module.css';

/** Props for `<ZoomControl>`. */
export interface ZoomControlProps {
  /** Current zoom as a scale factor: 1 is actual size. */
  zoom: number;
  /** `onZoomInput` and `onZoomChange` are the kit's edit protocol's `onInput` and `onChange`
   *  (`docs/conventions.md`, "Edit callbacks"): a drag and a typed zoom are each one edit. */
  onZoomInput?: (zoom: number) => void;
  onZoomChange: (zoom: number) => void;
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

/** Zoom as a log-scaled slider with an editable percentage beside it. Pair it
 *  with zoom-in / zoom-out buttons in a `<Bar.Group>`; this component owns
 *  only the continuous part. */
export function ZoomControl({
  zoom,
  onZoomInput,
  onZoomChange,
  min: minProp = 0.1,
  max: maxProp = 8,
  className,
}: ZoomControlProps) {
  const min = normalizeZoom(minProp);
  const max = normalizeZoom(maxProp);
  const zoomAt = (track: number): number => clamp(fromTrack(track), min, max);

  return (
    <div className={className ? `${s.zoom} ${className}` : s.zoom}>
      <Slider
        className={s.slider}
        aria-label="Zoom"
        thumbShape="dot"
        trackHeight="var(--wzl-slider-track-h)"
        thumbSize="var(--wzl-slider-thumb-size)"
        min={toTrack(min)}
        max={toTrack(max)}
        // Detents at the octaves plus actual size, so 25/50/100/200/400% are
        // reachable by drag rather than only by typing.
        stops={[-2, -1, 0, 1, 2]}
        thumbs={[{ value: clamp(toTrack(zoom), toTrack(min), toTrack(max)) }]}
        onInput={onZoomInput && ((next) => onZoomInput(zoomAt(next[0].value)))}
        onChange={(next) => onZoomChange(zoomAt(next[0].value))}
        readoutPlacement="none"
      />
      {/* `style: 'percent'` formats a fraction, so the field carries the scale
          factor itself and renders 0.5 as "50%". */}
      <NumberField
        className={s.field}
        width="fit"
        aria-label="Zoom"
        value={zoom}
        minValue={min}
        maxValue={max}
        step={0.01}
        hideSteppers
        ghost
        formatOptions={{ style: 'percent', maximumFractionDigits: 0 }}
        onChange={(next) => {
          if (!Number.isFinite(next)) return;
          onZoomChange(clamp(next, min, max));
        }}
      />
    </div>
  );
}
