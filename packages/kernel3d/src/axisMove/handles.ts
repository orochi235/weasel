/**
 * The handles an axis move is pressed on: one arrow per world axis, out of the
 * selection's center, drawn in screen space at a fixed length on screen
 * whatever the camera's distance.
 */

import { polygonContainsPoint, pointSegmentDist, type Point } from '@weasel-js/geom';
import { add, dot, normalize, scale, sub, type Vec3 } from '@weasel-js/geom/3d';
import { cameraBasis } from '../camera';
import { projectPoint, type Viewport3d } from '../project';
import { subjectOf } from '../snap/probes3d';
import { DEFAULT_UP, inWorld, type World3d } from '../world';

/** A world axis an axis move runs along. */
export type WorldAxis = 'x' | 'y' | 'z';

/** The three, in the order handles are drawn and hit. */
export const WORLD_AXES: readonly WorldAxis[] = ['x', 'y', 'z'];

/** The unit direction of each world axis. */
export const AXIS_DIRECTIONS: Readonly<Record<WorldAxis, Vec3>> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

/** Red, green and blue for x, y and z. */
export const AXIS_COLORS: Readonly<Record<WorldAxis, string>> = {
  x: '#e5484d',
  y: '#46a758',
  z: '#3e7bf6',
};

/** One axis's arrow, in the screen space of the viewport it was laid out in. */
export interface AxisHandle {
  axis: WorldAxis;
  /** The shaft, from the selection's center to the base of the head. */
  from: Point;
  to: Point;
  /** The head: its tip, then the two corners of its base. */
  head: readonly [Point, Point, Point];
  color: string;
}

/** How the handles are laid out. */
export interface AxisHandleOptions {
  /** Each arrow's length on screen, head included, in px, as it would be
   *  seen side-on: one pointing toward the camera draws shorter. Default 80. */
  lengthPx?: number;
  /** The head's length, in px. Default 14. */
  headPx?: number;
  /** The axes given handles. Default all three. */
  axes?: readonly WorldAxis[];
}

/** An arrow drawn shorter than this points too nearly at the camera to drag along, and gets no handle. */
const MIN_SCREEN_PX = 12;

/**
 * The selection's axis handles in `viewport`: none when nothing in `ids` is
 * in the scene, and none for an axis that points too nearly at the camera,
 * or whose arrow does not project.
 */
export function axisHandles<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  ids: readonly string[],
  viewport: Viewport3d,
  opts: AxisHandleOptions = {},
): AxisHandle[] {
  const up = world.up ?? DEFAULT_UP;
  const subject = subjectOf(world, ids, normalize(up));
  if (!subject) return [];
  const vp = inWorld(world, viewport);
  const center = scale(add(subject.box.min, subject.box.max), 0.5);
  const from = projectPoint(center, vp);
  if (!from) return [];
  const lengthPx = opts.lengthPx ?? 80;
  const headPx = Math.min(opts.headPx ?? 14, lengthPx / 2);
  const reach = lengthPx * worldPerPxAt(vp, center);
  const out: AxisHandle[] = [];
  for (const axis of opts.axes ?? WORLD_AXES) {
    const tip = projectPoint(add(center, scale(AXIS_DIRECTIONS[axis], reach)), vp);
    if (!tip) continue;
    const length = Math.hypot(tip.x - from.x, tip.y - from.y);
    if (length < MIN_SCREEN_PX) continue;
    const ux = (tip.x - from.x) / length;
    const uy = (tip.y - from.y) / length;
    const head = Math.min(headPx, length / 2);
    const base = { x: tip.x - ux * head, y: tip.y - uy * head };
    const half = head * 0.4;
    out.push({
      axis,
      from,
      to: base,
      head: [tip, { x: base.x - uy * half, y: base.y + ux * half }, { x: base.x + uy * half, y: base.y - ux * half }],
      color: AXIS_COLORS[axis],
    });
  }
  return out;
}

/** World units per screen px at `p`'s depth. */
function worldPerPxAt(vp: Viewport3d, p: Vec3): number {
  const { eye, forward } = cameraBasis(vp.camera, vp.up);
  return (Math.max(0, dot(sub(p, eye), forward)) * 2 * Math.tan(vp.camera.fov / 2)) / Math.max(1, vp.height);
}

/** The handle under `point`, within `hitPx` of its shaft or head: the nearest
 *  when several are, or null for none. */
export function axisHandleAt(handles: readonly AxisHandle[], point: Point, hitPx = 6): AxisHandle | null {
  let best: AxisHandle | null = null;
  let bestD = hitPx;
  for (const h of handles) {
    const [tip, b1, b2] = h.head;
    const onHead = polygonContainsPoint([tip.x, tip.y, b1.x, b1.y, b2.x, b2.y], point.x, point.y);
    const d = onHead ? 0 : pointSegmentDist(point.x, point.y, h.from.x, h.from.y, tip.x, tip.y);
    if (d <= bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}
