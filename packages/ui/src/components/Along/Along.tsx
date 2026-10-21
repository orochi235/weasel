import { useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { arcShape, type TrackShape } from '@weasel-js/geom';
import { useBoxes, type Box } from '../Slider/useBoxes';
import { AlongContext, type AlongArc, type RunAlign } from './alongContext';
import { arcInBox } from './arcInBox';
import s from './Along.module.css';

/** Props of `Along`. */
export interface AlongProps {
  /** The arc to lay in the box. `shape` wins over it. Default: the top half. */
  arc?: AlongArc;
  /** A track shape, or one built from the box. */
  shape?: TrackShape | ((box: Box) => TrackShape);
  /** Where a run shorter than the track sits. Default `'center'`. */
  align?: RunAlign;
  className?: string;
  children: ReactNode;
}

const TOP_HALF: AlongArc = { start: 270, end: 90 };
const NONE: Box = { width: 0, height: 0 };

/** Fills its containing block and hands controls inside it a track shape sized from that box. */
export function Along({ arc = TOP_HALF, shape, align = 'center', className, children }: AlongProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const box = useBoxes(() => [ref.current], 1)[0] ?? NONE;
  const { width, height } = box;
  const { start, end, direction, radius, center, inset } = arc;
  const cx = center?.x;
  const cy = center?.y;
  const ctx = useMemo(() => {
    const b = { width, height };
    const made =
      typeof shape === 'function'
        ? shape(b)
        : shape ??
          arcShape(arcInBox({ start, end, direction, radius, inset, center: cx === undefined ? undefined : { x: cx, y: cy! } }, b));
    return { shape: made, align };
  }, [width, height, shape, start, end, direction, radius, inset, cx, cy, align]);
  return (
    <div ref={ref} className={className ? `${s.along} ${className}` : s.along}>
      <AlongContext.Provider value={ctx}>{children}</AlongContext.Provider>
    </div>
  );
}
