import {
  ellipsePath,
  regularPolygonPath,
  starPath,
  type Path
} from '@weasel-js/geom';
import type { Stroke, Fill } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { RectPose } from 'core/scene/types';
import { commandFill, commandStroke } from '@weasel-js/renderer';
import { PAINT_SLOT } from './memo';
import { inkReach, withAnimatedVertexColors } from './nodePaint';
import { resolveFill, resolveStroke } from '@weasel-js/paint';
import { paintsPose, poseBoxBounds } from './poseBox';
import { outsetPoseBox, strokedPoseBox } from './strokedBounds';

// ─── Built-in painters ─────────────────────────────────────────────────
/** Built-in shape dispatcher — matches when `data.shape` names a kit-known
 *  shape kind. Computes both paint and silhouette from the pose so consumer
 *  scenes can declare clipping/rendering directly in JSON without
 *  registering a custom painter. */
export const SHAPE_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:shape',
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const s = (node.data as { shape?: string } | null)?.shape;
    return s != null && SHAPE_KINDS.has(s);
  },
  // Memoized: a pure function of `(data, pose)`, and `pathForShape` builds a
  // fresh `Uint8Array` + `Float32Array` for every ellipse, polygon and star.
  // See PAINT_SLOT.
  paint: (node, pose, ctx) => withAnimatedVertexColors(nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as { shape: string; fill?: Fill | null; stroke?: Stroke | null; sides?: number; points?: number };
    const path = pathForShape(d, pose);
    const declaredFill = resolveFill(d.fill);
    const shapeFill = declaredFill && commandFill(declaredFill, pose);
    const strokeSpec = resolveStroke(d.stroke);
    const stroke = strokeSpec && commandStroke(strokeSpec, pose);
    return [{
      kind: 'path',
      path,
      ...(shapeFill ? { fill: shapeFill } : {}),
      ...(stroke ? { stroke } : {}),
    }];
  }), ctx),
  silhouette: (node, pose) => {
    const d = node.data as { shape: string; sides?: number; points?: number };
    return pathForShape(d, pose);
  },
  ink: (node, _pose, ctx) => {
    const d = node.data as { fill?: Fill | null; stroke?: Stroke | null };
    return {
      filled: resolveFill(d.fill) !== null,
      ...inkReach(resolveStroke(d.stroke), ctx?.scale),
    };
  },
  // Every shape kind is inscribed in the pose box.
  bounds: (node, pose, ctx) =>
    poseBoxBounds(pose, resolveStroke((node.data as { stroke?: Stroke | null }).stroke), ctx),
  // A rect's or an ellipse's stroke reaches its box evenly; a polygon's or a
  // star's corners are sharper than a right angle, so their miters are measured.
  drawnBounds: (node, pose, ctx) => {
    const d = node.data as { shape: string; stroke?: Stroke | null; sides?: number; points?: number };
    const stroke = resolveStroke(d.stroke);
    return d.shape === 'polygon' || d.shape === 'star'
      ? strokedPoseBox(node, pose, stroke, ctx, (at) => pathForShape(d, at))
      : outsetPoseBox(pose, stroke, ctx);
  },
};

export const SHAPE_KINDS = new Set(['rect', 'ellipse', 'polygon', 'star']);

export function pathForShape(
  d: { shape: string; sides?: number; points?: number },
  p: RectPose,
): Path {
  switch (d.shape) {
    case 'ellipse':
      return ellipsePath(p);
    case 'polygon': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return regularPolygonPath({ x: cx, y: cy }, r, d.sides ?? 6);
    }
    case 'star': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return starPath({ x: cx, y: cy }, r, d.points ?? 5);
    }
    case 'rect':
    default:
      return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  }
}
