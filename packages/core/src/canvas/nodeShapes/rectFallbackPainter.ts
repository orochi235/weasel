import type { Fill, Inherit } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import type { RectPose } from 'core/scene/types';
import { commandFill } from '@weasel-js/renderer';
import { resolveFill } from '@weasel-js/paint';
import { paintsPose, poseBoxBounds } from './poseBox';

// ─── Built-in painters ─────────────────────────────────────────────────
export const RECT_FALLBACK_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  // Last-resort painter — matches any rect-posed mark, so it must be
  // registered last within `'normal'`. Nothing clips to its box (`clipOutline`).
  // Consumers who want a different
  // fallback should register their own painter at `'high'` priority and let
  // this one never fire (or unregister it explicitly).
  id: 'kit:rect-fallback',
  matches: (node) => node.kind !== 'group' && paintsPose(node.pose),
  paint: (node, pose, ctx) => {
    const d = node.data as { fill?: Fill | Inherit | null } | null;
    const p = pose;
    const declared = resolveFill(d?.fill, ctx?.inherited?.fill);
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
