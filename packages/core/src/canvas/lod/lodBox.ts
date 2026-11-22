/** What the built-in `box` rung draws: the node's pose box, filled, in place of the node and its children. */
import { boundsOfPath } from '@weasel-js/geom';
import { resolveFill, type Fill, type Inherit, type PaintedFill } from '@weasel-js/paint';
import { commandFill, type DrawCommand } from '@weasel-js/renderer';
import type { InheritedPaint } from 'core/scene/inheritedPaint';
import { nodeMemo } from 'core/scene/nodeMemo';
import { isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';

/** The fill a `box` rung takes when the node names none: a mid gray that reads on light and dark pages. */
export const LOD_BOX_FILL: PaintedFill = { paint: { kind: 'solid', color: 'rgba(128,128,128,0.45)' } };

const SLOT = 'shape:lod-box';

type BoxData = { background?: Fill | null; fill?: Fill | Inherit | null } | null | undefined;

/** The fill of `node`'s box: a group's `background`, else its `fill` (what its children inherit);
 *  a mark's own fill; else {@link LOD_BOX_FILL}. */
function boxFillOf(node: { kind?: string; data?: unknown }, inherited: InheritedPaint | undefined): PaintedFill {
  const d = node.data as BoxData;
  const own = node.kind === 'group' ? resolveFill(d?.background ?? null) ?? resolveFill(d?.fill, inherited?.fill ?? null)
    : resolveFill(d?.fill, inherited?.fill ?? null);
  return own ?? LOD_BOX_FILL;
}

/** The `box` rung's commands for `node` at `pose`: one filled rect over its pose box, or `[]` for a
 *  pose with no box. */
export function paintLodBox(
  node: { kind?: string; data?: unknown },
  pose: unknown,
  inherited?: InheritedPaint,
): DrawCommand[] {
  const box = isRectPose(pose) ? pose : isPathLike(pose) ? boundsOfPath(pose) : null;
  if (box === null) return [];
  return nodeMemo(node, SLOT, pose, (): DrawCommand[] => {
    const fill = commandFill(boxFillOf(node, inherited), box);
    return [{ kind: 'path', path: { kind: 'rect', x: box.x, y: box.y, width: box.width, height: box.height }, ...(fill ? { fill } : {}) }];
  });
}
