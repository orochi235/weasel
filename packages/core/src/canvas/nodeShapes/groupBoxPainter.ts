import type { Fill, Stroke } from '@weasel-js/paint';
import { resolveFill, resolveStroke } from '@weasel-js/paint';
import { commandFill, commandStroke, type DrawCommand } from '@weasel-js/renderer';
import type { Path } from '@weasel-js/geom';
import type { NodeInkCtx } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { poseBoxBounds } from './poseBox';
import { outsetPoseBox } from './strokedBounds';

/**
 * What a group paints of its own: its pose box, filled with `background` and
 * stroked with `border`, under its children. Not `fill` and `stroke`, which on
 * a group are the paint its children's `'inherit'` takes, as an SVG `<g>`'s are.
 */
export interface GroupBoxData {
  background?: Fill | null;
  border?: Stroke | null;
}

const SLOT = 'shape:group-box';

function boxPaintOf(data: unknown): { fill: ReturnType<typeof resolveFill>; stroke: ReturnType<typeof resolveStroke> } {
  const d = (data ?? {}) as GroupBoxData;
  return { fill: resolveFill(d.background ?? null), stroke: resolveStroke(d.border ?? null) };
}

/** Whether a group with `data` at `pose` paints a box. */
export function paintsGroupBox(data: unknown, pose: unknown): pose is RectPose {
  if (!isRectPose(pose)) return false;
  const { fill, stroke } = boxPaintOf(data);
  return fill !== null || stroke !== null;
}

/** The outline of a group's box, in the pose's local frame: what it paints along and, with
 *  `clip: 'outline'` and no `data.path`, what it clips its children to. */
export function groupBoxPath(pose: RectPose): Path {
  return { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height };
}

/** A group's box paint at `pose`, or `[]` when it paints none. */
export function paintGroupBox(node: { data?: unknown }, pose: unknown): DrawCommand[] {
  if (!paintsGroupBox(node.data, pose)) return [];
  const box = pose;
  return nodeMemo(node, SLOT, box, (): DrawCommand[] => {
    const paint = boxPaintOf(node.data);
    const fill = paint.fill && commandFill(paint.fill, box);
    const stroke = paint.stroke && commandStroke(paint.stroke, box);
    return [{ kind: 'path', path: groupBoxPath(box), ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) }];
  });
}

/** The box a group's box paint fits in, for the cull, or `null` when it paints none. */
export function groupBoxBounds(data: unknown, pose: unknown, ctx: NodeInkCtx | undefined): Bounds | null {
  return paintsGroupBox(data, pose) ? poseBoxBounds(pose, boxPaintOf(data).stroke, ctx) : null;
}

/** The box a group's box paint covers, its border included, or `null` when it paints none. */
export function groupBoxDrawnBounds(data: unknown, pose: unknown, ctx: NodeInkCtx | undefined): Bounds | null {
  return paintsGroupBox(data, pose) ? outsetPoseBox(pose, boxPaintOf(data).stroke, ctx) : null;
}
