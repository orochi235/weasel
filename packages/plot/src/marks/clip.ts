/** Data geometry cut to a convex plot area at compile time, so nothing past the area is drawn by any renderer or export. */
import type { PlotPoint } from './types';

/** A convex area as its corners, in order either way round. */
export type ConvexArea = readonly PlotPoint[];

/** A rect's corners. */
export const rectArea = (r: { x: number; y: number; width: number; height: number }): ConvexArea => [
  { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height },
];

/** A circle as the regular polygon of `sides` around it, so the circle lies wholly inside. */
export function circleArea(center: PlotPoint, radius: number, sides = 72): ConvexArea {
  const r = radius / Math.cos(Math.PI / sides);
  return Array.from({ length: sides }, (_, k) => {
    const a = (2 * Math.PI * k) / sides;
    return { x: center.x + r * Math.sin(a), y: center.y - r * Math.cos(a) };
  });
}

/** The far bound a coordinate is held to before clipping: finite, and past any plot. */
const FAR = 1e300;

/** `p` with each coordinate held to ±1e300, so an infinite one still clips. */
export const finitePoint = (p: PlotPoint): PlotPoint => ({
  x: Math.min(FAR, Math.max(-FAR, p.x)), y: Math.min(FAR, Math.max(-FAR, p.y)),
});

/** The half-planes whose meet is an area, each answering how far inside it a point is, positive inside. */
interface Sides {
  readonly count: number;
  at(i: number, p: PlotPoint): number;
  /** The area's centroid. */
  readonly center: PlotPoint;
}

/** `area`'s sides, in their own units. An area with no inside (a segment, or a point) has its bounds too, which hold
 *  it to what it is: its sides alone are a line, or nothing. */
function sidesOf(area: ConvexArea): Sides {
  let twice = 0;
  area.forEach((p, i) => {
    const q = area[(i + 1) % area.length]!;
    twice += p.x * q.y - q.x * p.y;
  });
  const sign = Math.sign(twice) || 1;
  const n = area.length;
  const xs = area.map((p) => p.x);
  const ys = area.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const bounds = [(p: PlotPoint) => p.x - x0, (p: PlotPoint) => x1 - p.x, (p: PlotPoint) => p.y - y0, (p: PlotPoint) => y1 - p.y];
  return {
    count: twice === 0 ? n + bounds.length : n,
    at(i, p) {
      if (i >= n) return bounds[i - n]!(p);
      const a = area[i]!;
      const b = area[(i + 1) % n]!;
      return sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    },
    center: { x: xs.reduce((a, v) => a + v, 0) / n, y: ys.reduce((a, v) => a + v, 0) / n },
  };
}

/** Whether `p` lies inside every one of `sides`, or on one. */
function within(sides: Sides, p: PlotPoint): boolean {
  for (let i = 0; i < sides.count; i++) if (!(sides.at(i, p) >= 0)) return false;
  return true;
}

/** `p`, or where the line from the area's centroid to it leaves the area when it lies outside: a last guard for a
 *  crossing whose ends were both too far out to place it exactly. */
function into(sides: Sides, p: PlotPoint): PlotPoint {
  if (within(sides, p)) return p;
  const c = sides.center;
  let k = 1;
  for (let i = 0; i < sides.count; i++) {
    const sp = sides.at(i, p);
    if (sp < 0) k = Math.min(k, sides.at(i, c) / (sides.at(i, c) - sp));
  }
  // A point a rounding outside scales by a share that rounds to 1, or lands a rounding outside again: each try pulls
  // it a little further in.
  for (let tries = 0; tries < 8; tries++, k *= 1 - 1e-12 * 16 ** tries) {
    const q = { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
    if (within(sides, q)) return q;
  }
  return c;
}

/** Whether `p` lies inside `area` or on its edge. */
export const insideArea = (area: ConvexArea, p: PlotPoint): boolean => within(sidesOf(area), p);

/** Where the segment `p`→`q` crosses a line its ends sit `sp` and `sq` inside of, measured from the nearer end, so a
 *  far end does not swamp the share. */
function crossing(p: PlotPoint, q: PlotPoint, sp: number, sq: number): PlotPoint {
  if (Math.abs(sp) <= Math.abs(sq)) {
    const t = sp / (sp - sq);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  }
  const u = sq / (sq - sp);
  return { x: q.x + (p.x - q.x) * u, y: q.y + (p.y - q.y) * u };
}

/** How far along its line from the point nearest `area` a segment end may lie before it is moved in: four times the
 *  area's breadth, so a moved end stays outside it. Far ends leave every share near 0 or 1, where they no longer tell
 *  edges apart. */
function reachOf(area: ConvexArea): number {
  const xs = area.map((p) => p.x);
  const ys = area.map((p) => p.y);
  return 4 * Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 1;
}

/** `p`→`q` with each end past `reach` of the point on its line nearest `area`'s first corner moved in, along the line. */
function nearSegment(area: ConvexArea, reach: number, p: PlotPoint, q: PlotPoint): [PlotPoint, PlotPoint] {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  if (!(len > reach)) return [p, q];
  const c = area[0]!;
  const d = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
  // Measured from the nearer end, so a far one does not cancel the foot's digits away.
  const o = Math.hypot(p.x - c.x, p.y - c.y) <= Math.hypot(q.x - c.x, q.y - c.y) ? p : q;
  const s = (c.x - o.x) * d.x + (c.y - o.y) * d.y;
  const m = { x: o.x + d.x * s, y: o.y + d.y * s };
  const end = (e: PlotPoint): PlotPoint => {
    const k = (e.x - m.x) * d.x + (e.y - m.y) * d.y;
    return Math.abs(k) <= reach ? e : { x: m.x + d.x * Math.sign(k) * reach, y: m.y + d.y * Math.sign(k) * reach };
  };
  return [end(p), end(q)];
}

/** The part of the segment `p`→`q` inside `area`, its ends with their shares along it, or `null` for none. */
function clipSegment(
  area: ConvexArea, sides: Sides, reach: number, from: PlotPoint, to: PlotPoint,
): { t0: number; t1: number; a: PlotPoint; b: PlotPoint } | null {
  const [p, q] = nearSegment(area, reach, from, to);
  let t0 = 0;
  let t1 = 1;
  let a = p;
  let b = q;
  for (let i = 0; i < sides.count; i++) {
    const sp = sides.at(i, p);
    const sq = sides.at(i, q);
    if (sp < 0 && sq < 0) return null;
    if (sp >= 0 && sq >= 0) continue;
    const t = sp / (sp - sq);
    if (sp < 0 && t >= t0) [t0, a] = [t, crossing(p, q, sp, sq)];
    else if (sq < 0 && t <= t1) [t1, b] = [t, crossing(p, q, sp, sq)];
    if (t0 > t1) return null;
  }
  return { t0, t1, a, b };
}

/** The runs of the polyline through `points` inside `area`; a lone point inside is a run of one. */
export function clipPolyline(area: ConvexArea, points: readonly PlotPoint[]): PlotPoint[][] {
  const sides = sidesOf(area);
  const reach = reachOf(area);
  const pts = points.map(finitePoint);
  if (pts.length === 1) return insideArea(area, pts[0]!) ? [[pts[0]!]] : [];
  const runs: PlotPoint[][] = [];
  let open: PlotPoint[] | null = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const cut = clipSegment(area, sides, reach, pts[i]!, pts[i + 1]!);
    if (cut === null) {
      open = null;
      continue;
    }
    if (open === null || cut.t0 > 0) {
      open = [into(sides, cut.a)];
      runs.push(open);
    }
    open.push(into(sides, cut.b));
    if (cut.t1 < 1) open = null;
  }
  return runs;
}

/** The polygon through `points` cut to `area`: empty where none of it lies inside. */
export function clipPolygon(area: ConvexArea, points: readonly PlotPoint[]): PlotPoint[] {
  const sides = sidesOf(area);
  const reach = reachOf(area);
  let out = points.map(finitePoint);
  for (let i = 0; i < sides.count && out.length > 0; i++) {
    const input = out;
    out = [];
    input.forEach((p, k) => {
      const q = input[(k + 1) % input.length]!;
      const sp = sides.at(i, p);
      const sq = sides.at(i, q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const [a, b] = nearSegment(area, reach, p, q);
        const [sa, sb] = [sides.at(i, a), sides.at(i, b)];
        // An edge the segment crosses only past the reach its ends were moved in to is crossed as it lies.
        out.push((sa >= 0) !== (sb >= 0) ? crossing(a, b, sa, sb) : crossing(p, q, sp, sq));
      }
    });
  }
  return out.map((p) => into(sides, p));
}
