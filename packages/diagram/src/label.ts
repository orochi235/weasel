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
  type PoseDescriptor,
  type Vec2,
} from '@weasel-js/core';

/** Where along an edge a label sits. */
export interface DiagramLabel {
  /** `'start'`, `'mid'` and `'end'` are 0, 0.5 and 1; a number is that
   *  fraction of the route's length. `{ waypoint: k }` is the edge's
   *  waypoint `k`, and a fraction between two waypoints is that far along the
   *  straight run between them — where `layered` leaves a label room. An
   *  edge without that waypoint puts the label at `'mid'`. */
  at: 'start' | 'mid' | 'end' | number | { waypoint: number };
  /** World units between the route and the label's near side, to the **left
   *  of the direction of travel** — above a left-to-right edge. Default 0,
   *  which centers the label on the line. */
  offset?: number;
}

const NAMED = { start: 0, mid: 0.5, end: 1 } as const;

/** The label trait on a node's data, or `null`. */
export function diagramLabelOf(node: { data: unknown }): DiagramLabel | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as { diagram?: unknown }).diagram;
  if (trait === null || typeof trait !== 'object') return null;
  const label = (trait as { label?: unknown }).label;
  if (label === null || typeof label !== 'object') return null;
  return 'at' in label ? (label as DiagramLabel) : null;
}

/** The point `k` waypoints along an edge's own waypoints, and the direction of
 *  the run it is on; `null` when the edge has no such waypoint. Read off the
 *  edge's data rather than its path, which only passes through them. */
function atWaypoint(data: unknown, k: number): { point: Vec2; tangent: Vec2 } | null {
  const trait = (data as { diagram?: { waypoints?: unknown } } | null)?.diagram;
  const points = trait?.waypoints;
  if (!Array.isArray(points) || points.length < 2 || !(k >= 0) || k > points.length - 1) return null;
  const i = Math.min(Math.floor(k), points.length - 2);
  const a = points[i] as Vec2;
  const b = points[i + 1] as Vec2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return null;
  const t = k - i;
  return {
    point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    tangent: { x: (b.x - a.x) / len, y: (b.y - a.y) / len },
  };
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

    const station = typeof label.at === 'object'
      ? atWaypoint(deps[0]!.node.data, label.at.waypoint) ?? pointAlongPath(path, 0.5)
      : pointAlongPath(path, typeof label.at === 'number' ? label.at : NAMED[label.at] ?? 0.5);
    if (station === null) return null;

    const bounds = geometry.getBounds(node.pose);
    const nx = station.tangent.y;
    const ny = -station.tangent.x;
    // Half the label's depth along the normal, so its near side, not its center, sits `offset` off the line.
    const offset = label.offset ?? 0;
    const reach = offset + Math.sign(offset) * (Math.abs(nx) * bounds.width + Math.abs(ny) * bounds.height) / 2;
    // Left of travel: with y down, that is above an edge running rightward.
    const x = station.point.x + nx * reach;
    const y = station.point.y + ny * reach;

    return translatePoseViaDescriptor(
      node.pose,
      x - (bounds.x + bounds.width / 2),
      y - (bounds.y + bounds.height / 2),
      geometry,
    );
  };
}

/** Registry key for {@link LABEL_DERIVE_POSE}. */
export const DIAGRAM_LABEL = 'diagram:label';

/** The default label derivation, as one stable function reference so `toJSON`
 *  can find its key. */
export const LABEL_DERIVE_POSE = labelDerivePose<unknown>();
