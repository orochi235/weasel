import { ellipseShape, lineShape, polygonFromPoints, type PolygonPath, type TrackShape } from '@weasel-js/geom';
import type { WidgetBounds } from '../widget';

/** Px from a lens's outer edge to the centerline of the controls that ring it. */
export const RIM_GAP = 14;
/** How thick a band of controls is across its track. */
export const BAND = 20;

/** Where on the ring each control runs, as degrees clockwise from 12 o'clock, both counterclockwise: the zoom from
 *  the lower left through 6 o'clock, then the mode switch on toward 4 o'clock. */
const ARCS = { zoom: [266, 176], mode: [170, 102] } as const;
/** Where along a rect lens's bottom each control runs, as fractions of its width. */
const SPANS = { zoom: [0.04, 0.6], mode: [0.66, 0.96] } as const;

/** Where the pin sits on a round lens's ring, as those degrees: just past the mode switch's end. */
const PIN_AT = 92;

/** Which control a track carries. */
export type RimPart = keyof typeof ARCS;

/** The track `part` lies along outside a lens whose window is `b`: an arc concentric with a round lens, a line under
 *  a rect one. `out` moves it that many px further from the lens, keeping each fraction abreast of the same one on
 *  the track itself: where labels set along it stand. */
export function rimTrackIn(b: WidgetBounds, round: boolean, part: RimPart, out = 0): TrackShape {
  if (round) {
    const radius = b.width / 2 + RIM_GAP + out;
    const [start, end] = ARCS[part];
    return ellipseShape({
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, radiusX: radius, radiusY: radius,
      start, end, direction: 'ccw',
    });
  }
  const y = b.y + b.height + RIM_GAP + out;
  const [from, to] = SPANS[part];
  return lineShape({ x: b.x + b.width * from, y }, { x: b.x + b.width * to, y });
}

/** Where a lens whose window is `b` docks its pin: on the ring just past the mode switch, or past the end of a rect
 *  lens's controls. */
export function pinDockIn(b: WidgetBounds, round: boolean): { x: number; y: number } {
  if (!round) return { x: b.x + b.width + RIM_GAP, y: b.y + b.height + RIM_GAP };
  const radius = b.width / 2 + RIM_GAP;
  const turn = (PIN_AT * Math.PI) / 180;
  return { x: b.x + b.width / 2 + radius * Math.sin(turn), y: b.y + b.height / 2 - radius * Math.cos(turn) };
}

/** The stretch of `track` from fraction `f0` to `f1`, thickened to `BAND` across it, as one closed shape. */
export function bandPath(track: TrackShape, f0: number, f1: number, samples = 16): PolygonPath {
  const half = BAND / 2;
  const at = Array.from({ length: samples + 1 }, (_, i) => track.at(f0 + ((f1 - f0) * i) / samples));
  const side = (s: number) => at.map(({ point: p, normal: n }) => ({ x: p.x + n.x * half * s, y: p.y + n.y * half * s }));
  return polygonFromPoints([...side(1), ...side(-1).reverse()]);
}

/** The room the controls round a lens whose window is `b` take: its bounds grown past the band. */
export function ringBoundsOf(b: WidgetBounds): WidgetBounds {
  const g = RIM_GAP + BAND + 24;
  return { x: b.x - g, y: b.y - g, width: b.width + g * 2, height: b.height + g * 2 };
}
