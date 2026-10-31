import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import s from './Slider.module.css';
import type { SliderProps, Thumb } from './types';
import { useRegionDrag, type RegionDragArgs } from './useRegionDrag';

export interface SliderRegionProps {
  index: number;
  /** Its ends as fractions of the value span, in value order. */
  from: number;
  to: number;
  direction: 'ltr' | 'rtl';
  onPointerDown: ((e: ReactPointerEvent) => void) | undefined;
  children: ReactNode;
}

const pct = (f: number) => `${f * 100}%`;

/** One stretch of a straight track between neighboring thumbs, holding whatever `renderRegion` drew for it. */
export function SliderRegion({ index, from, to, direction, onPointerDown, children }: SliderRegionProps): ReactElement {
  const [left, right] = direction === 'rtl' ? [1 - to, from] : [from, 1 - to];
  return (
    <div className={s.region} data-slider-region={index} style={{ left: pct(left), right: pct(right) }} onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}

/** What draws a slider's regions: its props and span, the map from a value to its place, and the geometry it lies along. */
export interface SliderRegionsArgs<T extends Thumb> extends RegionDragArgs<T> {
  props: RegionDragArgs<T>['props'] & Pick<SliderProps<T>, 'renderRegion' | 'regionDrag'>;
  direction: 'ltr' | 'rtl';
}

/** The region before thumb `i`, or after the last for `i === thumbs.length`; null where the slider draws none. */
export function useSliderRegions<T extends Thumb>(args: SliderRegionsArgs<T>): (i: number) => ReactNode {
  const { props, min, max, scale, geometry, direction } = args;
  const regionDown = useRegionDrag<T>(args);
  return (i) => {
    // Only a straight track draws regions: a stretch of a curve has no box to fill.
    if (!props.renderRegion || geometry.curved) return null;
    const { thumbs } = props;
    const from = i === 0 ? min : thumbs[i - 1].value;
    const to = i === thumbs.length ? max : thumbs[i].value;
    return (
      <SliderRegion key={`region-${i}`} index={i} from={scale.valueToFraction(from)} to={scale.valueToFraction(to)} direction={direction} onPointerDown={props.regionDrag ? regionDown(i) : undefined}>
        {props.renderRegion({ index: i, from, to })}
      </SliderRegion>
    );
  };
}
