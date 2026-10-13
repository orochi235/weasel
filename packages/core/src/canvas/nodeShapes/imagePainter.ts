import {
  linePath
} from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { NodeShapeEntry } from 'canvas/NodeShape';
import type { Node, RectPose } from 'core/scene/types';
import {
  getImageBitmap, imageStatus, type ImageNodeData, type ImageRasterSize,
} from '@weasel-js/renderer';
import type { DrawCommand } from '@weasel-js/renderer';
import { paintsPose, poseBoxBounds } from './poseBox';

// ─── Built-in painters ─────────────────────────────────────────────────

export function sourceInPixels(
  s: NonNullable<ImageNodeData['image']['source']>,
  bmp: ImageBitmap,
): { x: number; y: number; w: number; h: number } {
  return {
    x: s.x * bmp.width, y: s.y * bmp.height, w: s.width * bmp.width, h: s.height * bmp.height,
  };
}

/** The whole bitmap's size in device pixels when `source` of it fills `pose`. */
export function drawnSize(
  pose: RectPose,
  source: ImageNodeData['image']['source'],
  pixelScale: number | undefined,
): ImageRasterSize | undefined {
  if (!(pixelScale && pixelScale > 0)) return undefined;
  return {
    width: Math.abs(pose.width) * pixelScale / (source?.width || 1),
    height: Math.abs(pose.height) * pixelScale / (source?.height || 1),
  };
}

/** Raster-image painter. Renders `data.image.src` (URL / blob: / data-URI)
 *  via an `ImageDrawCommand` once the bitmap has decoded; until then it paints
 *  a faint placeholder outline so the node stays visible + selectable (a
 *  reddish outline + slash marks a failed load). The decoded bitmap is owned
 *  by `imageCache`, keyed on `src`; the node holds only the serializable `src`.
 *  Registered before `kit:rect-fallback` so image nodes don't fall through. */
export const IMAGE_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:image',
  matches: (node) => {
    if (!paintsPose(node.pose)) return false;
    const src = (node.data as { image?: { src?: unknown } } | null)?.image?.src;
    return typeof src === 'string' && src.length > 0;
  },
  paint: (node, pose, ctx) => {
    const d = node.data as ImageNodeData;
    const p = pose;
    const bmp = ctx?.resolveImage
      ? ctx.resolveImage(node as unknown as Node<unknown, string, unknown>)
      : getImageBitmap(d.image.src, drawnSize(p, d.image.source, ctx?.pixelScale));
    if (bmp) {
      return [{
        kind: 'image',
        image: bmp,
        x: p.x, y: p.y, w: p.width, h: p.height,
        ...(d.image.opacity !== undefined ? { opacity: d.image.opacity } : {}),
        ...(d.image.source ? { source: sourceInPixels(d.image.source, bmp) } : {}),
        ...(d.image.flipX ? { flipX: true } : {}),
        ...(d.image.flipY ? { flipY: true } : {}),
      }];
    }
    // Not ready — faint placeholder (grey while loading, reddish + slash on
    // error). With a caller-supplied resolver the fallback is deterministic:
    // always the plain grey outline, no ambient load-status read.
    const error = ctx?.resolveImage ? false : imageStatus(d.image.src) === 'error';
    const color = error ? '#d08a8a' : '#bbbbbb';
    const cmds: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      stroke: { paint: { color }, width: 1 },
    }];
    if (error) {
      cmds.push({
        kind: 'path',
        path: linePath({ x: p.x, y: p.y }, { x: p.x + p.width, y: p.y + p.height }),
        stroke: { paint: { color }, width: 1 },
      });
    }
    return cmds;
  },
  silhouette: (_node, pose) => {
    const p = pose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
  // The placeholder's 1-unit outline is the only thing that leaves the box.
  bounds: (_node, pose, ctx) => poseBoxBounds(pose, IMAGE_PLACEHOLDER_STROKE, ctx),
};

export const IMAGE_PLACEHOLDER_STROKE: Stroke = { paint: { color: '#000' }, width: 1 };
