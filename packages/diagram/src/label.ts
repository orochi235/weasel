/**
 * A label on an edge: an ordinary leaf node that derives its *pose* from the
 * route it sits on.
 *
 * It reads the edge's resolved path off its dependency rather than routing
 * again, so the label and the arrowhead can never disagree about where the
 * edge went. Everything else about it is a normal scene node — its own size,
 * data, styling, z-order and selection.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  pointAlongPath,
  translatePoseViaDescriptor,
  type DerivedDep,
  type Path,
  type PoseDescriptor,
  type Vec2,
} from '@weasel-js/core';
import {
  PATH_C, PATH_L, PATH_Q, forEachSegment, nearestOnCubic, nearestOnLine, nearestOnQuadratic, type CurveNearest,
} from '@weasel-js/geom';
import { diagramLabelOf, type DiagramLabel } from './labelTrait';

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

/** Where the center of a label `size` big sits along `path`; `null` for a
 *  path with no points. */
export function labelCenter(path: Path, label: DiagramLabel, size: { width: number; height: number }): Vec2 | null {
  const station = typeof label.at === 'object'
    ? nearestStation(path, label.at.near) ?? pointAlongPath(path, 0.5)
    : pointAlongPath(path, typeof label.at === 'number' ? label.at : NAMED[label.at] ?? 0.5);
  if (station === null) return null;
  const nx = station.tangent.y;
  const ny = -station.tangent.x;
  // Half the label's depth along the normal, so its near side, not its center, sits `offset` off the line.
  const offset = label.offset ?? 0;
  const reach = offset + Math.sign(offset) * (Math.abs(nx) * size.width + Math.abs(ny) * size.height) / 2;
  // Left of travel: with y down, that is above an edge running rightward.
  return { x: station.point.x + nx * reach, y: station.point.y + ny * reach };
}

/** Options for {@link labelDerivePose}. `geometry` defaults to the kit's
 *  `AUTO_POSE_DESCRIPTOR`. */
export interface LabelPoseOptions<TPose> {
  geometry?: PoseDescriptor<TPose>;
}

/**
 * A `derivePose` that stations a label along its dependency's path.
 *
 * Returns `null` — nothing derived, so the node keeps its authored pose —
 * when the node carries no label trait, when the dependency is gone, or when
 * the dependency derives no path. A label that snapped to the origin because
 * its edge was deleted is worse than one that stayed where the author left it.
 */
export function labelDerivePose<TPose>(
  opts: LabelPoseOptions<TPose> = {},
): (node: { pose: TPose; data: unknown }, deps: readonly (DerivedDep<TPose> | undefined)[]) => TPose | null {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);

  return (node, deps) => {
    const label = diagramLabelOf(node);
    if (label === null) return null;
    const path = deps[0]?.path ?? null;
    if (path === null) return null;

    const bounds = geometry.getBounds(node.pose);
    const center = labelCenter(path, label, bounds);
    if (center === null) return null;

    return translatePoseViaDescriptor(
      node.pose,
      center.x - (bounds.x + bounds.width / 2),
      center.y - (bounds.y + bounds.height / 2),
      geometry,
    );
  };
}

/** Registry key for {@link LABEL_DERIVE_POSE}. */
export const DIAGRAM_LABEL = 'diagram:label';

/** The default label derivation, as one stable function reference so `toJSON`
 *  can find its key. */
export const LABEL_DERIVE_POSE = labelDerivePose<unknown>();
