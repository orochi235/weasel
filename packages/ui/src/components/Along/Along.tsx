import { useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { AlongContext, type AlongArc, type RunAlign } from './alongContext';
import { useBoxShape, type BoxShape } from './useBoxShape';
import s from './Along.module.css';

/** Props of `Along`. */
export interface AlongProps {
  /** The arc to lay in the box. `shape` wins over it. Default: the top half. */
  arc?: AlongArc;
  /** A track shape, or one built from the box. */
  shape?: BoxShape;
  /** Where a run shorter than the track sits. Default `'center'`. */
  align?: RunAlign;
  className?: string;
  children: ReactNode;
}

export const TOP_HALF: AlongArc = { start: 270, end: 90 };

/**
 * Fills its containing block and hands controls inside it a track shape sized from that box.
 *
 * An arc's angles are degrees clockwise from 12 o'clock on a y-down plane; the default arc is the inscribed
 * circle's top half. An arc is given by its ends, or by the direction its middle faces and its span in degrees or
 * px: `{ at: 0, span: '180px' }` keeps a 180 px top arc however large the box grows. The box takes no pointer
 * input, only the controls inside it do, so a press elsewhere reaches whatever lies beneath. Two `Along`s over one
 * box with different arcs put, say, a `Bar` along the top and a `Slider` along the bottom of one circle.
 *
 * `Slider`, `DetentSlider`, `Bar`, `Jog`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `SwatchGrid`, `SwatchStrip`,
 * `Tabs`, `PageTabs` and `RadioGroup` follow the shape; any other control renders as it does outside an `Along`.
 * For text alone along a shape, use `CurvedLabel`.
 */
export function Along({ arc = TOP_HALF, shape, align = 'center', className, children }: AlongProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const made = useBoxShape(ref, arc, shape);
  const ctx = useMemo(() => ({ shape: made, align }), [made, align]);
  return (
    <div ref={ref} className={className ? `${s.along} ${className}` : s.along}>
      <AlongContext.Provider value={ctx}>{children}</AlongContext.Provider>
    </div>
  );
}
