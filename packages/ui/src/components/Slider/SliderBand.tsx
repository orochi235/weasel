import type { PointerEvent as ReactPointerEvent, ReactElement, Ref } from 'react';
import { trackShapeD, type TrackShape } from '@weasel-js/geom';
import s from './Slider.module.css';

/** A curved slider's track: a band stroked along the whole shape. Presses land only on the band's
 *  stroke and its slop, so the empty middle of an arc's circle is not track. */
export function SliderBand({ shape, faceRef, onPointerDown }: {
  shape: TrackShape;
  /** The face, whose stroke width is the band's thickness. */
  faceRef: Ref<SVGPathElement>;
  onPointerDown: (e: ReactPointerEvent<Element>) => void;
}): ReactElement {
  const d = trackShapeD(shape);
  return (
    <svg className={s.band} aria-hidden="true">
      <path className={s.bandSlop} d={d} data-slider-band onPointerDown={onPointerDown} />
      <path className={s.bandEdge} d={d} />
      <path className={s.bandFace} d={d} ref={faceRef} />
    </svg>
  );
}
