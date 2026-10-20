/**
 * Where a label stands on a route: the arithmetic `labelDerivePose` runs,
 * kept free of the scene so the router and the placer can station a label
 * without one.
 */
import { pointAlongPath, type Path, type Vec2 } from '@weasel-js/core/math';
import {
  PATH_C, PATH_L, PATH_Q, forEachSegment, nearestOnCubic, nearestOnLine, nearestOnQuadratic, type CurveNearest,
} from '@weasel-js/geom';
import type { DiagramLabel } from '../labelTrait';

const NAMED = { start: 0, mid: 0.5, end: 1 } as const;

/** The point on `path` nearest `near`, and the heading of the path there;
 *  `null` for a path with no segment to stand on. */
function nearestStation(path: Path, near: Vec2): { point: Vec2; tangent: Vec2 } | null {
  if (path.kind !== 'polygon') return null;
  const { commands, coords } = path;
  let best: CurveNearest | null = null;
  let heading: Vec2 = { x: 1, y: 0 };
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
    if (len === 0 || (best !== null && hit.dist >= best.dist)) return;
    best = hit;
    heading = { x: d.x / len, y: d.y / len };
  });
  const found = best as CurveNearest | null;
  return found === null ? null : { point: { x: found.x, y: found.y }, tangent: heading };
}

/** Where the center of a label `size` big sits along `path`, at the station
 *  placement chose for it when it has one; `null` for a path with no points. */
export function labelCenter(path: Path, label: DiagramLabel, size: { width: number; height: number }): Vec2 | null {
  const at = label.placed ?? label;
  const station = typeof at.at === 'object'
    ? nearestStation(path, at.at.near) ?? pointAlongPath(path, 0.5)
    : pointAlongPath(path, typeof at.at === 'number' ? at.at : NAMED[at.at] ?? 0.5);
  if (station === null) return null;
  const nx = station.tangent.y;
  const ny = -station.tangent.x;
  // Half the label's depth along the normal, so its near side, not its center, sits `offset` off the line.
  const offset = at.offset ?? 0;
  const reach = offset + Math.sign(offset) * (Math.abs(nx) * size.width + Math.abs(ny) * size.height) / 2;
  // Left of travel: with y down, that is above an edge running rightward.
  return { x: station.point.x + nx * reach, y: station.point.y + ny * reach };
}
