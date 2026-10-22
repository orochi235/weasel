import type { Point } from '../paths/cubicMath';
import type { ArcTrackShape } from './arc';
import type { EllipseTrackShape } from './ellipse';
import type { PathTrackShape } from './path';
import { pathToD } from '../paths/pathToD';
import type { TrackShape } from './shape';

const SAMPLES = 64;

const num = (v: number): string => {
  const r = Math.round(v * 1e4) / 1e4;
  return String(r === 0 ? 0 : r);
};
const pt = (p: Point): string => `${num(p.x)} ${num(p.y)}`;
const isArc = (s: TrackShape): s is ArcTrackShape => s.kind === 'arc' && 'arc' in s;
const isPath = (s: TrackShape): s is PathTrackShape => s.kind === 'path' && 'path' in s;
const isEllipse = (s: TrackShape): s is EllipseTrackShape => s.kind === 'ellipse' && 'ellipse' in s;

/** Arcs of radii `rx` by `ry` from `a` to `b` turning `turn` radians: one arc, or two halves through `m` for a whole turn. */
function arcsD(a: Point, b: Point, m: () => Point, rx: number, ry: number, turn: number, sweep: 0 | 1): string {
  const r = `${num(rx)} ${num(ry)}`;
  if (turn >= 2 * Math.PI - 1e-9) return `M ${pt(a)} A ${r} 0 0 ${sweep} ${pt(m())} A ${r} 0 0 ${sweep} ${pt(b)}`;
  return `M ${pt(a)} A ${r} 0 ${turn > Math.PI + 1e-9 ? 1 : 0} ${sweep} ${pt(b)}`;
}

/** SVG path data for the stretch `from..to` of a shape: a segment for a line, true arcs for an arc or an ellipse, else a
 *  64-step polyline. A whole path shape is its path's own data. */
export function trackShapeD(shape: TrackShape, from = 0, to = 1): string {
  if (isPath(shape) && from === 0 && to === 1) return pathToD(shape.path);
  const a = shape.at(from).point;
  const b = shape.at(to).point;
  if (shape.kind === 'line') return `M ${pt(a)} L ${pt(b)}`;
  const m = () => shape.at((from + to) / 2).point;
  if (isArc(shape)) {
    const { radius, direction } = shape.arc;
    const turn = (shape.length * Math.abs(to - from)) / radius;
    return arcsD(a, b, m, radius, radius, turn, (direction === 'ccw') === to < from ? 1 : 0);
  }
  if (isEllipse(shape)) {
    const { radiusX, radiusY, direction, center } = shape.ellipse;
    // The turn is in the ellipse's own parameter, which is what SVG's large-arc flag reads.
    const param = (p: Point) => Math.atan2((p.x - center.x) / radiusX, (center.y - p.y) / radiusY);
    const sign = direction === 'ccw' ? -1 : 1;
    const whole = (shape.ellipse.start - shape.ellipse.end) % 360 === 0 && Math.abs(to - from) >= 1 - 1e-12;
    const raw = (sign * Math.sign(to - from) * (param(b) - param(a)) + 4 * Math.PI) % (2 * Math.PI);
    return arcsD(a, b, m, radiusX, radiusY, whole ? 2 * Math.PI : raw, (direction === 'ccw') === to < from ? 1 : 0);
  }
  let d = `M ${pt(a)}`;
  for (let i = 1; i <= SAMPLES; i++)
    d += ` L ${pt(shape.at(from + ((to - from) * i) / SAMPLES).point)}`;
  return d;
}
