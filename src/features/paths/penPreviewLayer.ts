/**
 * Screen-space preview layer for `useUserPenTool`. Reads the tool's
 * persistent scratch each frame and renders the in-progress path: finished
 * subpaths (faded), the current subpath (bright + anchor dots + handles),
 * a rubber-band segment from the latest anchor to the cursor, and a
 * close-hint ring on the first anchor when the tool flags it as hot.
 *
 * Runs in screen space so anchor/handle sizes stay constant under zoom.
 * All world-space coords go through `worldToScreen` via the layer's `view`
 * argument.
 */

import type { RenderLayer } from '../../core/layers/render';
import type { Tool } from '../../tools/types';
import type { PenScratch, PenAnchor, PenSubpath } from '../../tools/builtin/useUserPenTool';

export interface PenPreviewStyle {
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  rubberBandStroke?: string;
  closeHintFill?: string;
  finishedSubpathStroke?: string;
}

export interface CreatePenPreviewLayerOptions {
  /** The Tool returned by useUserPenTool. The layer reads its scratch via
   *  `tool.initScratch()` (the hook is contracted to return a stable ref). */
  penTool: Tool<PenScratch>;
  style?: PenPreviewStyle;
}

const DEFAULT_STYLE: Required<PenPreviewStyle> = {
  anchorFill: '#d4c4a8',
  anchorStroke: '#d4c4a8',
  handleStroke: '#d4c4a8',
  rubberBandStroke: '#d4c4a8',
  closeHintFill: '#d4c4a8',
  finishedSubpathStroke: '#8a7a5e',
};

const ANCHOR_RADIUS_PX = 4;
const HANDLE_DOT_RADIUS_PX = 3;
const CLOSE_HINT_RADIUS_PX = 8;

function w2s(wx: number, wy: number, view: { x: number; y: number; scale: number }): [number, number] {
  return [(wx - view.x) * view.scale, (wy - view.y) * view.scale];
}

function mirror(anchor: PenAnchor, out: { x: number; y: number } | undefined): { x: number; y: number } | undefined {
  if (!out || anchor.altBroken) return undefined;
  return { x: 2 * anchor.x - out.x, y: 2 * anchor.y - out.y };
}

function strokeSubpath(
  ctx: CanvasRenderingContext2D,
  sp: PenSubpath,
  view: { x: number; y: number; scale: number },
  color: string,
): void {
  if (sp.anchors.length === 0) return;
  ctx.beginPath();
  const [sx, sy] = w2s(sp.anchors[0].x, sp.anchors[0].y, view);
  ctx.moveTo(sx, sy);
  for (let i = 1; i < sp.anchors.length; i++) {
    const prev = sp.anchors[i - 1];
    const curr = sp.anchors[i];
    const out = prev.outHandle;
    const inH = curr.inHandle ?? mirror(prev, out);
    const [tx, ty] = w2s(curr.x, curr.y, view);
    if (out || curr.inHandle) {
      const c1 = out ?? prev;
      const c2 = inH ?? curr;
      const [c1x, c1y] = w2s(c1.x, c1.y, view);
      const [c2x, c2y] = w2s(c2.x, c2.y, view);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
    } else {
      ctx.lineTo(tx, ty);
    }
  }
  if (sp.closed) {
    const last = sp.anchors[sp.anchors.length - 1];
    const first = sp.anchors[0];
    const out = last.outHandle;
    const inH = first.inHandle ?? mirror(last, out);
    if (out || first.inHandle) {
      const c1 = out ?? last;
      const c2 = inH ?? first;
      const [c1x, c1y] = w2s(c1.x, c1.y, view);
      const [c2x, c2y] = w2s(c2.x, c2.y, view);
      const [tx, ty] = w2s(first.x, first.y, view);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
    }
    ctx.closePath();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawAnchorDot(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fill: string,
  stroke: string,
): void {
  ctx.beginPath();
  ctx.arc(sx, sy, ANCHOR_RADIUS_PX, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export function createPenPreviewLayer(
  opts: CreatePenPreviewLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };
  // Stable scratch ref — the pen tool contract guarantees identity stability.
  const getScratch = (): PenScratch => opts.penTool.initScratch!();

  return {
    id: 'penPreview',
    label: 'Pen preview',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const s = getScratch();

      // Finished subpaths — faded outline.
      for (const sp of s.finishedSubpaths) {
        strokeSubpath(ctx, sp, view, style.finishedSubpathStroke);
      }

      const cur = s.current;
      if (!cur && s.cursor === null) return;

      // Current subpath — bright outline.
      if (cur) {
        strokeSubpath(ctx, cur, view, style.rubberBandStroke);
      }

      // Rubber-band from latest anchor to cursor (only when not mid-handle-drag).
      if (cur && cur.anchors.length > 0 && s.cursor && s.draggingHandleAt === null) {
        const last = cur.anchors[cur.anchors.length - 1];
        const out = last.outHandle;
        const [sx, sy] = w2s(last.x, last.y, view);
        const [cx, cy] = w2s(s.cursor.x, s.cursor.y, view);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        if (out) {
          // Curve preview: c1 = outHandle, c2 = mirrored from outHandle through cursor (best-guess preview).
          const [c1x, c1y] = w2s(out.x, out.y, view);
          ctx.bezierCurveTo(c1x, c1y, cx, cy, cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = style.rubberBandStroke;
        ctx.stroke();
      }

      // Anchor dots + handles for current subpath.
      if (cur) {
        for (let i = 0; i < cur.anchors.length; i++) {
          const a = cur.anchors[i];
          const [ax, ay] = w2s(a.x, a.y, view);
          drawAnchorDot(ctx, ax, ay, style.anchorFill, style.anchorStroke);
          // Handle line + dot (only the latest anchor's outHandle, per spec).
          if (i === cur.anchors.length - 1 && a.outHandle) {
            const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(hx, hy);
            ctx.lineWidth = 1;
            ctx.strokeStyle = style.handleStroke;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(hx, hy, HANDLE_DOT_RADIUS_PX, 0, Math.PI * 2);
            ctx.fillStyle = style.handleStroke;
            ctx.fill();
          }
        }

        // Close-hint ring on first anchor.
        if (s.closeHintActive && cur.anchors.length >= 3) {
          const first = cur.anchors[0];
          const [fx, fy] = w2s(first.x, first.y, view);
          ctx.beginPath();
          ctx.arc(fx, fy, CLOSE_HINT_RADIUS_PX, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = style.closeHintFill;
          ctx.stroke();
        }
      }
    },
  };
}
