/**
 * `laneStackLayout` — a pool's lanes, stacked along one axis in the order they
 * sit and stretched across the body past the header. The pool's size along
 * the stack is the sum of its lanes; its size across is the author's.
 *
 * Like every strategy it sees ids and poses only: the title is told apart by
 * its name, and which nodes a pool admits (lanes) is `diagramCanDropInto`'s call.
 */
import {
  createTransformOp,
  type ContainerBounds,
  type LayoutArrival,
  type LayoutChild,
  type LayoutContainer,
  type LayoutStrategy,
  type Op,
  type RectPose,
} from '@weasel-js/core';
import { titlePose } from './titlePose';
import { bodyBox, titleIdOf, type ContainerHeader } from './trait';

/** Options for {@link laneStackLayout}. */
export interface LaneStackOptions {
  /** The axis lanes stack along: `'y'` for a pool of rows, `'x'` for columns. */
  axis: 'x' | 'y';
  /** The header's depth, across the stack. Default {@link POOL_HEADER_SIZE}. */
  headerSize?: number;
}

/** A pool header's default depth. */
export const POOL_HEADER_SIZE = 32;
/** The least a lane is along the stack. */
export const MIN_LANE_SIZE = 40;

type Lane = LayoutChild<RectPose>;

/** The header a pool stacking along `axis` has: across the stack, at its start. */
export const poolHeader = (axis: 'x' | 'y', size = POOL_HEADER_SIZE): ContainerHeader =>
  ({ side: axis === 'y' ? 'left' : 'top', size });

/** Where lanes of the given sizes sit, in order, in a pool at `bounds`. */
export function stackedLanes(
  axis: 'x' | 'y',
  bounds: ContainerBounds,
  header: ContainerHeader,
  lanes: readonly { id: string; size: number }[],
): Map<string, RectPose> {
  const body = bodyBox(bounds, header);
  const out = new Map<string, RectPose>();
  let at = axis === 'y' ? bounds.y : bounds.x;
  for (const { id, size } of lanes) {
    out.set(id, axis === 'y'
      ? { x: body.x, y: at, width: body.width, height: size }
      : { x: at, y: body.y, width: size, height: body.height });
    at += size;
  }
  return out;
}

/** A pool stacking its lanes along `axis`. */
export function laneStackLayout(opts: LaneStackOptions): LayoutStrategy<RectPose> {
  const { axis } = opts;
  const header = poolHeader(axis, opts.headerSize);
  const along = (p: { width: number; height: number }) => (axis === 'y' ? p.height : p.width);
  const mid = (p: RectPose) => (axis === 'y' ? p.y + p.height / 2 : p.x + p.width / 2);
  const lanesOf = (container: LayoutContainer, children: readonly Lane[], skip?: string) =>
    children.filter((c) => c.id !== titleIdOf(container.id) && c.id !== skip).sort((a, b) => mid(a.pose) - mid(b.pose));
  const sized = (lanes: readonly Lane[]) => lanes.map((l) => ({ id: l.id, size: along(l.pose) }));
  const withTitle = (container: LayoutContainer, children: readonly Lane[], poses: Map<string, RectPose>, bounds = container.bounds) => {
    if (children.some((c) => c.id === titleIdOf(container.id))) poses.set(titleIdOf(container.id), titlePose(bounds, header));
    return poses;
  };
  /** The pool sized to hold `lanes`, and where they sit in it. */
  const resized = (container: LayoutContainer, children: readonly Lane[], lanes: readonly Lane[]): LayoutArrival<RectPose> => {
    const sizes = sized(lanes);
    const total = Math.max(MIN_LANE_SIZE, sizes.reduce((s, l) => s + l.size, 0));
    const bounds = axis === 'y' ? { ...container.bounds, height: total } : { ...container.bounds, width: total };
    return { poses: withTitle(container, children, stackedLanes(axis, bounds, header, sizes), bounds), bounds };
  };
  const insertAt = (container: LayoutContainer, children: readonly Lane[], dragged: Lane, index: number) => {
    const sizes = sized(lanesOf(container, children, dragged.id));
    sizes.splice(index, 0, { id: dragged.id, size: along(dragged.pose) });
    return stackedLanes(axis, container.bounds, header, sizes);
  };
  const shifted: LayoutStrategy<RectPose>['reflowPoses'] = (container, children, dragged, target) => {
    if (target === null) return new Map();
    const poses = insertAt(container, children, dragged, (target.meta as { index: number }).index);
    poses.delete(dragged.id);
    return poses;
  };

  return {
    snap: {
      pickTarget(targets, pointer) {
        const p = axis === 'y' ? pointer.y : pointer.x;
        let best = null;
        for (const t of targets) {
          if (best === null || Math.abs(t.origin[axis] - p) < Math.abs(best.origin[axis] - p)) best = t;
        }
        return best;
      },
    },

    childPoses(container, children) {
      const sizes = sized(lanesOf(container, children));
      const last = sizes[sizes.length - 1];
      if (last !== undefined) {
        const slack = along(container.bounds) - sizes.reduce((s, l) => s + l.size, 0);
        last.size = Math.max(MIN_LANE_SIZE, last.size + slack);
      }
      return withTitle(container, children, stackedLanes(axis, container.bounds, header, sizes));
    },

    getDropTargets(container, children, dragged) {
      const count = lanesOf(container, children, dragged.id).length;
      const self = { id: dragged.id, pose: dragged.pose };
      const targets = [];
      for (let index = 0; index <= count; index++) {
        const pose = insertAt(container, children, self, index).get(dragged.id)!;
        targets.push({ pose, origin: { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 }, meta: { index } });
      }
      return targets;
    },

    reflowPoses: shifted,

    commitDrop(container, children, dragged, target) {
      const ops: Op[] = [];
      const poses = shifted(container, children, dragged, target);
      for (const c of children) {
        const to = poses.get(c.id);
        if (to !== undefined && (to.x !== c.pose.x || to.y !== c.pose.y)) {
          ops.push(createTransformOp<RectPose>({ id: c.id, from: c.pose, to, label: 'Shift lane' }));
        }
      }
      ops.push(createTransformOp<RectPose>({
        id: dragged.id, from: dragged.originPose, to: target?.pose ?? dragged.pose, label: 'Move lane',
      }));
      return ops;
    },

    arrive: (container, children) => resized(container, children, lanesOf(container, children)),
    depart: (container, children) => resized(container, children, lanesOf(container, children)),

    dropRegion(container) {
      const b = container.bounds;
      const body = bodyBox(b, header);
      return { kind: 'rect', x: body.x - b.x, y: body.y - b.y, width: body.width, height: body.height };
    },

    releaseDrop: () => [],
  };
}
