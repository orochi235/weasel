import { useRef, type ReactElement, type ReactNode } from 'react';
import type { AlongArc, RunAlign } from './alongContext';
import { RunScope } from '../Run/run';
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

const TOP_HALF: AlongArc = { start: 270, end: 90 };

/**
 * Fills its containing block and sets the run of the controls inside it to a track shape sized from that box.
 *
 * An arc's angles are degrees clockwise from 12 o'clock on a y-down plane; the default arc is the inscribed
 * circle's top half. An arc is given by its ends, or by the direction its middle faces and its span in degrees or
 * px: `{ at: 0, span: '180px' }` keeps a 180 px top arc however large the box grows. A row of items laid along it
 * starts at the arc's start and runs its `direction`, so a clockwise top arc starts at its left end and a clockwise
 * bottom one at its right, each item standing upright wherever it sits; a slider's values, a `Jog`'s transport and
 * `CurvedLabel`'s text run in reading order. The box takes no pointer input, only the controls inside it do, so a
 * press elsewhere reaches whatever lies beneath. Two `Along`s over one box with different arcs put, say, a `Bar` along
 * the top and a `Slider` along the bottom of one circle.
 *
 * `Slider`, `DetentSlider`, `Bar`, `Jog`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `SwatchGrid`, `SwatchStrip`,
 * `Tabs`, `PageTabs` and `RadioGroup` follow the shape, and `CurvedLabel` lays text alone along it; any other control
 * renders as it does outside an `Along`. A control's root fills the box, so a `shape` given here is in the px of the
 * `Along`'s containing block.
 */
export function Along({ arc = TOP_HALF, shape, align = 'center', className, children }: AlongProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const made = useBoxShape(ref, arc, shape);
  return (
    <div ref={ref} className={className ? `${s.along} ${className}` : s.along}>
      <RunScope shape={made} align={align}>{children}</RunScope>
    </div>
  );
}
