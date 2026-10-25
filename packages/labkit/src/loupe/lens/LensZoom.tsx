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
  /** Called when a press on the zoom ends, to hand the keys back to the lens canvas: the zoom sits outside it. */
  onRelease?: () => void;
}

/**
 * A lens body's zoom: a slider across the bottom of its rim, stopping at the factors the zoom keys step through. It
 * writes the factor as those keys do, so the reticle resizes with it, and a whole drag folds into one undo entry.
 * Only its band and thumb take presses; a press anywhere else on the body reaches the body. A press reaches neither the
 * lens canvas's input element nor its dispatcher, so `onRelease` hands both back when it ends; the arrow keys on a
 * thumb reached by Tab keep it.
 */
export function LensZoom<C>({
  scene,
  lensId,
  factor,
  shape,
  size,
  onFocus,
  onRelease,
}: LensZoomProps<C>) {
  const gesture = useRef(0);
  const pressed = useRef(false);
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
    if (!done) return;
    gesture.current += 1;
    if (pressed.current) {
      pressed.current = false;
      onRelease?.();
    }
  };
  const slider = (
    <Slider
      ariaLabel="Zoom"
      min={FACTOR_MIN}
      max={FACTOR_MAX}
      stops={STOPS}
      spacing="even"
      snap="strict"
      thumbShape="dot"
      trackHeight="var(--wzl-slider-track-h)"
      thumbSize="var(--wzl-slider-thumb-size)"
      thumbs={thumbs}
      onInput={(next) => write(next, false)}
      onChange={(next) => write(next, true)}
    />
  );
  const track = zoomTrackOf(shape, size);
  return (
    <div
      className="lk-lens-zoom"
      data-track={track.kind}
      onPointerDownCapture={() => {
        pressed.current = true;
      }}
      onKeyDownCapture={() => {
        pressed.current = false;
      }}
    >
      {track.kind === 'arc' ? (
        <Along arc={track.arc}>{slider}</Along>
      ) : (
        <Along shape={track.shape}>{slider}</Along>
      )}
    </div>
  );
}
