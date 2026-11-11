/**
 * Where a label stands on a route: the arithmetic `labelDerivePose` runs,
 * kept free of the scene so the router and the placer can station a label
 * without one.
 */
import { pointAlongPath, type Path, type Vec2 } from '@weasel-js/core/math';
import {
  PATH_C, PATH_L, PATH_Q, forEachSegment, measurePath, nearestOnCubic, nearestOnLine, nearestOnQuadratic, worldCoords,
  type CurveNearest,
} from '@weasel-js/geom';
import type { DiagramLabel, LabelSpot } from '../labelTrait';
import { subpathOf } from '../subpaths';

const NAMED = { start: 0, mid: 0.5, end: 1 } as const;

/** The point on each segment of `path` nearest `near`, how far it is, and the heading of the path there. */
function segmentStations(path: Path, near: Vec2): { point: Vec2; tangent: Vec2; dist: number }[] {
  if (path.kind !== 'polygon') return [];
  const { commands } = path;
  const coords = worldCoords(path);
  const out: { point: Vec2; tangent: Vec2; dist: number }[] = [];
  forEachSegment(commands, coords, (cmd, ci, x0, y0) => {
    let hit: CurveNearest;
    let d: Vec2;
    if (cmd === PATH_L) {
      hit = nearestOnLine(near.x, near.y, x0, y0, coords[ci]!, coords[ci + 1]!);
      d = { x: coords[ci]! - x0, y: coords[ci + 1]! - y0 };
    } else if (cmd === PATH_Q) {
      hit = nearestOnQuadratic(near.x, near.y, x0, y0, coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!);
      const t = hit.t;
      d = {
        x: 2 * (1 - t) * (coords[ci]! - x0) + 2 * t * (coords[ci + 2]! - coords[ci]!),
        y: 2 * (1 - t) * (coords[ci + 1]! - y0) + 2 * t * (coords[ci + 3]! - coords[ci + 1]!),
      };
    } else if (cmd === PATH_C) {
      hit = nearestOnCubic(
        near.x, near.y, x0, y0,
        coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!, coords[ci + 4]!, coords[ci + 5]!,
      );
      const t = hit.t;
      const u = 1 - t;
      d = {
        x: 3 * u * u * (coords[ci]! - x0) + 6 * u * t * (coords[ci + 2]! - coords[ci]!) + 3 * t * t * (coords[ci + 4]! - coords[ci + 2]!),
        y: 3 * u * u * (coords[ci + 1]! - y0) + 6 * u * t * (coords[ci + 3]! - coords[ci + 1]!) + 3 * t * t * (coords[ci + 5]! - coords[ci + 3]!),
      };
    } else return;
    const len = Math.hypot(d.x, d.y);
    if (len === 0) return;
    out.push({ point: { x: hit.x, y: hit.y }, tangent: { x: d.x / len, y: d.y / len }, dist: hit.dist });
  });
  return out;
}

/** The point on `path` nearest `near`, and the heading of the path there;
 *  `null` for a path with no segment to stand on. */
function nearestStation(path: Path, near: Vec2): { point: Vec2; tangent: Vec2 } | null {
  let best: { point: Vec2; tangent: Vec2; dist: number } | null = null;
  for (const s of segmentStations(path, near)) if (best === null || s.dist < best.dist) best = s;
  return best === null ? null : { point: best.point, tangent: best.tangent };
}

/** Where the center of a label `size` big sits along `whole`, on its first
 *  subpath, at the station placement chose for it when it has one; `null`
 *  for a path with no points. */
export function labelCenter(whole: Path, label: DiagramLabel, size: { width: number; height: number }): Vec2 | null {
  const path = subpathOf(whole, 0) ?? whole;
  const at = label.placed ?? label;
  const station = typeof at.at === 'object'
    ? nearestStation(path, at.at.near) ?? pointAlongPath(path, 0.5)
    : pointAlongPath(path, typeof at.at === 'number' ? at.at : NAMED[at.at] ?? 0.5);
  if (station === null) return null;
  const beside = besideStation(station.point, station.tangent, at.offset ?? 0, size);
  const end = label.placed !== undefined || label.inset === undefined ? 0 : label.at === 'start' ? 1 : label.at === 'end' ? -1 : 0;
  if (end === 0) return beside;
  const { x: tx, y: ty } = station.tangent;
  const reach = end * (label.inset! + (Math.abs(tx) * size.width + Math.abs(ty) * size.height) / 2);
  return { x: beside.x + tx * reach, y: beside.y + ty * reach };
}

/** Half the depth of a label `size` big along the normal to `tangent`. */
function halfDepth(tangent: Vec2, size: { width: number; height: number }): number {
  return (Math.abs(tangent.y) * size.width + Math.abs(tangent.x) * size.height) / 2;
}

/** The center of a label `size` big whose near side sits `offset` left of
 *  travel from `point`; with y down, that is above an edge running rightward. */
function besideStation(point: Vec2, tangent: Vec2, offset: number, size: { width: number; height: number }): Vec2 {
  const reach = offset + Math.sign(offset) * halfDepth(tangent, size);
  return { x: point.x + tangent.y * reach, y: point.y - tangent.x * reach };
}

/** The inverse of `besideStation`: the offset a label centered at `center` reads at. */
function offsetFrom(point: Vec2, tangent: Vec2, center: Vec2, size: { width: number; height: number }): number {
  const d = (center.x - point.x) * tangent.y - (center.y - point.y) * tangent.x;
  const offset = Math.sign(d) * Math.max(Math.abs(d) - halfDepth(tangent, size), 0);
  return offset === 0 ? 0 : offset;
}

/** A route fraction small enough to move no label, large enough to pick a side of a vertex. */
const NUDGE = 1e-9;

/** The inverse of `labelCenter`: the route fraction and offset a label `size`
 *  big stands at when its center is at `center`, measured on the first
 *  subpath. `null` for a path with no points. Where several stretches of the
 *  route are nearest alike, the reading that stands the label nearest
 *  `center` wins. */
export function labelSpotAt(whole: Path, center: Vec2, size: { width: number; height: number }): LabelSpot | null {
  const path = subpathOf(whole, 0) ?? whole;
  const measure = measurePath(path);
  if (measure === null) return null;
  const station = measure.nearest(center);
  const first = spotFrom(measure, station, center, size);
  if (measure.length === 0) return first;
  const miss = (spot: LabelSpot) => {
    const back = labelCenter(path, spot, size);
    return back === null ? Infinity : Math.hypot(back.x - center.x, back.y - center.y);
  };
  const tie = 1e-9 * Math.max(1, Math.abs(center.x), Math.abs(center.y), measure.length);
  let best = first;
  let bestMiss = miss(first);
  if (bestMiss <= tie) return first;
  for (const other of segmentStations(path, center)) {
    if (other.dist > station.dist + tie) continue;
    const spot = spotFrom(measure, measure.nearest(other.point), center, size);
    const m = miss(spot);
    if (m < bestMiss - tie) [best, bestMiss] = [spot, m];
  }
  return best;
}

/** The spot read at `station`, the point on the route measured as nearest `center`. */
function spotFrom(
  measure: NonNullable<ReturnType<typeof measurePath>>,
  station: { s: number; point: Vec2; tangent: Vec2 },
  center: Vec2,
  size: { width: number; height: number },
): LabelSpot {
  if (measure.length === 0) return { at: 0.5, offset: offsetFrom(station.point, station.tangent, center, size) };
  const at = station.s / measure.length;
  const step = NUDGE * measure.length;
  const before = measure.at(station.s - step).tangent;
  const after = measure.at(station.s + step).tangent;
  if (before.x === after.x && before.y === after.y) {
    return { at, offset: offsetFrom(station.point, station.tangent, center, size) };
  }
  // At a vertex each leg reads the offset along its own normal. Keep the leg whose reading lands nearer
  // `center`, and step `at` onto that leg when `labelCenter` would read it on the other.
  const reads = measure.at(at * measure.length).tangent;
  let best: LabelSpot = { at, offset: 0 };
  let bestDist = Infinity;
  for (const [tangent, side] of [[before, -1], [after, 1]] as const) {
    const offset = offsetFrom(station.point, tangent, center, size);
    const back = besideStation(station.point, tangent, offset, size);
    const dist = Math.hypot(back.x - center.x, back.y - center.y);
    if (dist >= bestDist) continue;
    const onLeg = reads.x === tangent.x && reads.y === tangent.y;
    best = { at: onLeg ? at : Math.min(1, Math.max(0, at + side * NUDGE)), offset };
    bestDist = dist;
  }
  return best;
}
