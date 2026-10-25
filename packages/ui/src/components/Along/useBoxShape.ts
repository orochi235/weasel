import { useMemo, type RefObject } from 'react';
import { arcShape, type TrackShape } from '@weasel-js/geom';
import { useBoxes, type Box } from '../Slider/useBoxes';
import type { AlongArc } from './alongContext';
import { arcInBox } from './arcInBox';

/** A track shape, or one built from the box it is laid in. */
export type BoxShape = TrackShape | ((box: Box) => TrackShape);

const NONE: Box = { width: 0, height: 0 };

/** The track shape for `ref`'s laid-out box: `shape` when given, else `arc` laid in the box. Rebuilt when the box resizes
 *  or a field of `arc` changes, not when `arc` is a fresh object with the same fields. */
export function useBoxShape(ref: RefObject<HTMLElement | null>, arc: AlongArc, shape?: BoxShape): TrackShape {
  const { width, height } = useBoxes(() => [ref.current], 1, { untransformed: true })[0] ?? NONE;
  const { start, end, at, span, direction, radius, center, inset } = arc;
  const cx = center?.x;
  const cy = center?.y;
  return useMemo(() => {
    const b = { width, height };
    if (typeof shape === 'function') return shape(b);
    return (
      shape ??
      arcShape(arcInBox({ ...(span === undefined ? { start: start!, end: end! } : { at: at!, span }), direction, radius, inset, center: cx === undefined ? undefined : { x: cx, y: cy! } }, b))
    );
  }, [width, height, shape, start, end, at, span, direction, radius, inset, cx, cy]);
}
