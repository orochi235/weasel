import type { ArcTrackSpec } from '@weasel-js/geom';
import type { Box } from '../Slider/useBoxes';
import type { AlongArc } from './alongContext';

/** The arc spec for `arc` laid in `box`: inscribed circle less `inset`, centered, unless overridden. */
export function arcInBox(arc: AlongArc, box: Box): ArcTrackSpec {
  const inscribed = Math.min(box.width, box.height) / 2 - (arc.inset ?? 0);
  return {
    center: arc.center ?? { x: box.width / 2, y: box.height / 2 },
    radius: arc.radius ?? Math.max(0, inscribed),
    start: arc.start,
    end: arc.end,
    direction: arc.direction,
  };
}
