import { ellipseShape, lineShape, polygonFromPoints, type PolygonPath, type TrackShape } from '@weasel-js/geom';
import type { WidgetBounds } from '../widget';

/** Px from a lens's outer edge to the centerline of the controls that ring it. */
export const RIM_GAP = 14;
/** How thick a band of controls is across its track. */
export const BAND = 18;

/** Where on the ring each control runs, as degrees clockwise from 12 o'clock, both counterclockwise: the zoom from
 *  the lower left through 6 o'clock, then the mode switch on toward 4 o'clock. */
const ARCS = { zoom: [262, 174], mode: [166, 112] } as const;
/** Where along a rect lens's bottom each control runs, as fractions of its width. */
const SPANS = { zoom: [0.04, 0.6], mode: [0.66, 0.96] } as const;

/** Which control a track carries. */
export type RimPart = keyof typeof ARCS;

/** The track `part` lies along outside a lens whose window is `b`: an arc concentric with a round lens, a line under
 *  a rect one. */
export function rimTrackIn(b: WidgetBounds, round: boolean, part: RimPart): TrackShape {
  if (round) {
    const radius = b.width / 2 + RIM_GAP;
    const [start, end] = ARCS[part];
    return ellipseShape({
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, radiusX: radius, radiusY: radius,
      start, end, direction: 'ccw',
    });
  }
  const y = b.y + b.height + RIM_GAP;
  const [from, to] = SPANS[part];
  return lineShape({ x: b.x + b.width * from, y }, { x: b.x + b.width * to, y });
}

/** Which side of `track` faces away from the lens: an arc's normal does already, a line's points back up at it. */
export const outwardOf = (round: boolean): 1 | -1 => (round ? 1 : -1);

/** The stretch of `track` from fraction `f0` to `f1`, thickened to `BAND` across it, as one closed shape. */
export function bandPath(track: TrackShape, f0: number, f1: number, samples = 16): PolygonPath {
  const half = BAND / 2;
  const at = Array.from({ length: samples + 1 }, (_, i) => track.at(f0 + ((f1 - f0) * i) / samples));
  const side = (s: number) => at.map(({ point: p, normal: n }) => ({ x: p.x + n.x * half * s, y: p.y + n.y * half * s }));
  return polygonFromPoints([...side(1), ...side(-1).reverse()]);
}

/** The room the controls round a lens whose window is `b` take: its bounds grown past the band. */
export function ringBoundsOf(b: WidgetBounds): WidgetBounds {
  const g = RIM_GAP + BAND;
  return { x: b.x - g, y: b.y - g, width: b.width + g * 2, height: b.height + g * 2 };
}
