import type { FillStyle } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import type { RectPose } from 'core/scene/types';
import { commandFill } from '@weasel-js/renderer';
import { DEFAULT_SHAPE_FILL } from '../../util/paint';
import { resolveNodeFill } from './nodePaint';
import { paintsPose, poseBoxBounds } from './poseBox';

// ─── Built-in painters ─────────────────────────────────────────────────
export const RECT_FALLBACK_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  // Last-resort painter — matches any rect-posed node, so it must be
  // registered last within `'normal'`. Consumers who want a different
  // fallback should register their own painter at `'high'` priority and let
  // this one never fire (or unregister it explicitly).
  id: 'kit:rect-fallback',
  matches: (node) => paintsPose(node.pose),
  paint: (node, pose) => {
    const d = node.data as { fill?: FillStyle | null } | null;
    const p = pose;
    const declared = resolveNodeFill(d?.fill, DEFAULT_SHAPE_FILL);
    const fill = declared && commandFill(declared, p);
    return [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      ...(fill ? { fill } : {}),
    }];
  },
  silhouette: (_node, pose) => {
    const p = pose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
  bounds: (_node, pose) => poseBoxBounds(pose, null, undefined),
};
