/**
 * Snapping a scene's marks to an output target's dot grid for an export,
 * without touching the document: the snapped poses come back as a map, and
 * {@link withPoses} hands them to a `drawOne` in place of the scene's.
 */
import {
  gridAxis, snapModuleRun, snapRectToGrid, snapSpanToGrid,
  type OutputGrid, type Rect,
} from '@weasel-js/geom';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SceneViewDrawOne } from './NodeShape';

/** Marks laid side by side along one axis whose widths are whole modules, a barcode's bars. */
export interface OutputGridRun {
  /** The run's marks, in any order; they are laid out by where they sit. */
  ids: Iterable<NodeId>;
  /** One module's width in document units. */
  module: number;
  /** The axis the run lies along. Default `'x'`. */
  axis?: 'x' | 'y';
  /** Dots per module, for a symbology that names one; default the nearest count. */
  dots?: number;
}

/** Which marks to snap, and how. A node in neither is left where it is. */
export interface OutputGridSnapPlan {
  /** Marks snapped edge by edge, a rule or a box. */
  rects?: Iterable<NodeId>;
  /** Marks whose widths must agree with each other. */
  runs?: Iterable<OutputGridRun>;
}

const QUARTER = Math.PI / 2;

/** How many quarter turns `pose` is under, or null when it is under something else. */
function quarterTurns(pose: RectPose): number | null {
  if (pose.transform) return null;
  const q = (pose.rotation ?? 0) / QUARTER;
  return Math.abs(q - Math.round(q)) < 1e-9 ? Math.round(q) : null;
}

/** The world box `pose` covers, when that box is all of it. */
function boxOf(pose: RectPose): Rect | null {
  const q = quarterTurns(pose);
  if (q === null) return null;
  if (q % 2 === 0) return { x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  return { x: cx - pose.height / 2, y: cy - pose.width / 2, width: pose.height, height: pose.width };
}

/** `pose`, moved and sized so it covers `box`. */
function poseCovering(pose: RectPose, box: Rect): RectPose {
  const odd = quarterTurns(pose)! % 2 !== 0;
  const width = odd ? box.height : box.width;
  const height = odd ? box.width : box.height;
  return { ...pose, x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - height / 2, width, height };
}

/**
 * The world poses of `plan`'s marks with their edges on `grid`'s dot
 * boundaries, keyed by id, for an export to draw from through
 * {@link withPoses}. `poseOf` answers a node's world pose, the one `drawOne`
 * is handed; for a root node that is its own pose.
 *
 * A rect mark snaps each edge to the nearest boundary and keeps at least one
 * dot, so a hairline prints rather than vanishing. A run rounds its module
 * once and lays every mark out in whole modules from the boundary nearest
 * its first edge, so marks of equal width print equal, and its marks' other
 * axis snaps as a rect's would.
 *
 * Only a mark under no rotation or a quarter turn, and no skew, snaps; any
 * other is left out of the map and draws where it is, since its edges are not
 * parallel to a dot row. A run with such a member is left out whole. A 3D
 * host's marks reach this only as world poses on the output's plane.
 */
export function snapPosesToGrid(
  poseOf: (id: NodeId) => RectPose | undefined,
  grid: OutputGrid,
  plan: OutputGridSnapPlan,
): Map<NodeId, RectPose> {
  const out = new Map<NodeId, RectPose>();
  for (const id of plan.rects ?? []) {
    const pose = poseOf(id);
    const box = pose && boxOf(pose);
    if (box) out.set(id, poseCovering(pose, snapRectToGrid(box, grid)));
  }
  for (const run of plan.runs ?? []) snapRun(run, poseOf, grid, out);
  return out;
}

function snapRun(
  run: OutputGridRun,
  poseOf: (id: NodeId) => RectPose | undefined,
  grid: OutputGrid,
  out: Map<NodeId, RectPose>,
): void {
  const along = run.axis ?? 'x';
  const across = along === 'x' ? 'y' : 'x';
  const size = (a: 'x' | 'y') => (a === 'x' ? 'width' : 'height');
  const marks: { id: NodeId; pose: RectPose; box: Rect }[] = [];
  for (const id of run.ids) {
    const pose = poseOf(id);
    const box = pose && boxOf(pose);
    if (!box) return;
    marks.push({ id, pose, box });
  }
  if (marks.length === 0) return;
  marks.sort((a, b) => a.box[along] - b.box[along]);
  const start = marks[0]!.box[along];
  const widths: number[] = [];
  let at = start;
  for (const { box } of marks) {
    widths.push((box[along] - at) / run.module, box[size(along)] / run.module);
    at = box[along] + box[size(along)];
  }
  widths.shift();
  const { edges } = snapModuleRun({ start, module: run.module, widths }, gridAxis(grid, along), { dots: run.dots });
  const acrossAxis = gridAxis(grid, across);
  marks.forEach(({ id, pose, box }, i) => {
    const a = snapSpanToGrid(box[across], box[size(across)], acrossAxis);
    const lo = edges[2 * i]!;
    const snapped = along === 'x'
      ? { x: lo, y: a.start, width: edges[2 * i + 1]! - lo, height: a.length }
      : { x: a.start, y: lo, width: a.length, height: edges[2 * i + 1]! - lo };
    out.set(id, poseCovering(pose, snapped));
  });
}

/**
 * Wrap a `drawOne` so a node `poses` holds draws at that pose in place of the
 * one the walk hands it. With no map, `drawOne` comes back as it is.
 */
export function withPoses<TData, TLayer extends string, TPose>(
  poses: ReadonlyMap<NodeId, TPose> | undefined,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  if (!poses || poses.size === 0) return drawOne;
  return (node, pose, view, ctx) => drawOne(node, poses.get(node.id) ?? pose, view, ctx);
}
