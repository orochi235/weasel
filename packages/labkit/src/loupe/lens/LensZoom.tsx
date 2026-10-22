import { Along } from '@weasel-js/ui/components/Along';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { useMemo, useRef } from 'react';
import type { LoupeShape } from '../types';
import { FACTOR_MAX, FACTOR_MIN, FACTOR_STOPS } from './lensActionDefs';
import { applyLensOps, setLensOps, settingsOf } from './lensScene';
import type { LensScene } from './lensTypes';
import { zoomTrackOf } from './lensZoomTrack';

const STOPS = FACTOR_STOPS.map((value) => ({ value, label: `${value}×` }));

/** Props for `<LensZoom>`. */
export interface LensZoomProps<C> {
  scene: LensScene<C>;
  lensId: string;
  factor: number;
  shape: LoupeShape;
  /** The body's interior, in px. */
  size: { width: number; height: number };
  /** Called with this lens's id as the zoom writes, so the lens actions land on it after. */
  onFocus?: (lensId: string) => void;
}

/**
 * A lens body's zoom: a slider across the bottom of its rim, stopping at the factors the zoom keys step through. It
 * writes the factor as those keys do, so the reticle resizes with it, and a whole drag folds into one undo entry.
 * Only its band and thumb take presses; a press anywhere else on the body reaches the body.
 */
export function LensZoom<C>({ scene, lensId, factor, shape, size, onFocus }: LensZoomProps<C>) {
  const gesture = useRef(0);
  const thumbs = useMemo<Thumb[]>(() => [{ value: factor, valueText: `${factor}×` }], [factor]);
  const write = (next: Thumb[], done: boolean) => {
    const value = next[0]?.value;
    if (value !== undefined && value !== settingsOf(scene, lensId)?.factor) {
      onFocus?.(lensId);
      scene.batch(
        'zoom lens',
        () => applyLensOps(scene, setLensOps(scene, lensId, { factor: value })),
        {
          coalesceKey: `lens-zoom:${lensId}:${gesture.current}`,
        },
      );
    }
    if (done) gesture.current += 1;
  };
  const slider = (
    <Slider
      ariaLabel="Zoom"
      min={FACTOR_MIN}
      max={FACTOR_MAX}
      stops={STOPS}
      spacing="even"
      snap="strict"
      density="slim"
      thumbs={thumbs}
      onInput={(next) => write(next, false)}
      onChange={(next) => write(next, true)}
    />
  );
  const track = zoomTrackOf(shape, size);
  return (
    <div className="lk-lens-zoom" data-track={track.kind}>
      {track.kind === 'line' ? (
        <div className="lk-lens-zoom__line">{slider}</div>
      ) : track.kind === 'arc' ? (
        <Along arc={track.arc}>{slider}</Along>
      ) : (
        <Along shape={track.shape}>{slider}</Along>
      )}
    </div>
  );
}
