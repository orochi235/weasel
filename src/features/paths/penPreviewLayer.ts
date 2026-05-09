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

import type { DrawCommand } from '@orochi235/weasel-gl';
import type { RenderLayer } from '../../core/layers/render';
import type { Tool } from '../../tools/types';
import type { PenScratch, PenAnchor, PenSubpath } from '../../tools/builtin/useUserPenTool';
import { PATH_C, PATH_L, PATH_M, PATH_Z, type PolygonPath } from './types';

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

/** N-segment polygon approximation of a circle. N=24 → ≤0.5px deviation at r≤8. */
function approximateCircle(cx: number, cy: number, r: number, segments = 24): PolygonPath {
  const cmds = new Uint8Array(segments + 2);
  const coords = new Float32Array((segments + 1) * 2);
  cmds[0] = PATH_M;
  let off = 0;
  coords[off++] = cx + r;
  coords[off++] = cy;
  for (let i = 1; i < segments; i++) {
    cmds[i] = PATH_L;
    const theta = (i / segments) * Math.PI * 2;
    coords[off++] = cx + r * Math.cos(theta);
    coords[off++] = cy + r * Math.sin(theta);
  }
  cmds[segments] = PATH_L;
  // Close back to start (handled by PATH_Z; the last lineTo could be the
  // closing segment but PATH_Z is cleaner).
  cmds[segments + 1] = PATH_Z;
  // The trailing lineTo at index `segments` consumed two coords slots;
  // we wrote `segments` lineTos plus one moveTo = (segments+1) coord pairs,
  // but the array already sized for that. Trim if oversized.
  return {
    kind: 'polygon',
    commands: cmds,
    coords,
    fillRule: 'nonzero',
  };
}

/**
 * Build a `PolygonPath` for a pen subpath in screen space. Mirrors the
 * `strokeSubpath` 2D body — moves to the first anchor in screen coords,
 * emits cubic beziers when out/in handles are present, otherwise
 * linear segments.
 */
function subpathToPath(
  sp: PenSubpath,
  view: { x: number; y: number; scale: number },
): PolygonPath | null {
  if (sp.anchors.length === 0) return null;
  const cmds: number[] = [];
  const xs: number[] = [];
  const [sx, sy] = w2s(sp.anchors[0].x, sp.anchors[0].y, view);
  cmds.push(PATH_M);
  xs.push(sx, sy);
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
      cmds.push(PATH_C);
      xs.push(c1x, c1y, c2x, c2y, tx, ty);
    } else {
      cmds.push(PATH_L);
      xs.push(tx, ty);
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
      cmds.push(PATH_C);
      xs.push(c1x, c1y, c2x, c2y, tx, ty);
    }
    cmds.push(PATH_Z);
  }
  return {
    kind: 'polygon',
    commands: new Uint8Array(cmds),
    coords: new Float32Array(xs),
    fillRule: 'nonzero',
  };
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
    drawGL: (_data, view) => {
      const s = getScratch();
      const out: DrawCommand[] = [];

      // (1) Finished subpaths — faded outline.
      for (const sp of s.finishedSubpaths) {
        const path = subpathToPath(sp, view);
        if (path === null) continue;
        out.push({
          kind: 'path',
          path,
          stroke: { paint: { fill: 'solid', color: style.finishedSubpathStroke }, width: 1 },
        });
      }

      const cur = s.current;
      if (!cur && s.cursor === null) return out;

      // (2) Current subpath — bright outline.
      if (cur) {
        const path = subpathToPath(cur, view);
        if (path !== null) {
          out.push({
            kind: 'path',
            path,
            stroke: { paint: { fill: 'solid', color: style.rubberBandStroke }, width: 1 },
          });
        }
      }

      // (3) Rubber-band from latest anchor to cursor.
      if (cur && cur.anchors.length > 0 && s.cursor && s.draggingHandleAt === null) {
        const last = cur.anchors[cur.anchors.length - 1];
        const out2 = last.outHandle;
        const [sx, sy] = w2s(last.x, last.y, view);
        const [cx, cy] = w2s(s.cursor.x, s.cursor.y, view);
        let path: PolygonPath;
        if (out2) {
          const [c1x, c1y] = w2s(out2.x, out2.y, view);
          path = {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_C]),
            coords: new Float32Array([sx, sy, c1x, c1y, cx, cy, cx, cy]),
            fillRule: 'nonzero',
          };
        } else {
          path = {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_L]),
            coords: new Float32Array([sx, sy, cx, cy]),
            fillRule: 'nonzero',
          };
        }
        out.push({
          kind: 'path',
          path,
          stroke: { paint: { fill: 'solid', color: style.rubberBandStroke }, width: 1 },
        });
      }

      // (4) Anchor dots + handles.
      if (cur) {
        for (let i = 0; i < cur.anchors.length; i++) {
          const a = cur.anchors[i];
          const [ax, ay] = w2s(a.x, a.y, view);
          out.push({
            kind: 'path',
            path: approximateCircle(ax, ay, ANCHOR_RADIUS_PX),
            fill: { fill: 'solid', color: style.anchorFill },
            stroke: { paint: { fill: 'solid', color: style.anchorStroke }, width: 1 },
          });
          // Handle line + dot (only the latest anchor, per spec).
          if (i === cur.anchors.length - 1 && a.outHandle) {
            const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
            const linePath: PolygonPath = {
              kind: 'polygon',
              commands: new Uint8Array([PATH_M, PATH_L]),
              coords: new Float32Array([ax, ay, hx, hy]),
              fillRule: 'nonzero',
            };
            out.push({
              kind: 'path',
              path: linePath,
              stroke: { paint: { fill: 'solid', color: style.handleStroke }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: approximateCircle(hx, hy, HANDLE_DOT_RADIUS_PX),
              fill: { fill: 'solid', color: style.handleStroke },
            });
          }
        }

        // (5) Close-hint ring on first anchor.
        if (s.closeHintActive && cur.anchors.length >= 3) {
          const first = cur.anchors[0];
          const [fx, fy] = w2s(first.x, first.y, view);
          out.push({
            kind: 'path',
            path: approximateCircle(fx, fy, CLOSE_HINT_RADIUS_PX),
            stroke: { paint: { fill: 'solid', color: style.closeHintFill }, width: 1.5 },
          });
        }
      }

      return out;
    },
  };
}
