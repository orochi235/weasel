/**
 * Screen-space preview layer for `usePenTool`. Reads the tool's
 * persistent scratch each frame and renders the in-progress path: finished
 * subpaths (faded), the current subpath (bright + anchor dots + handles),
 * a rubber-band segment from the latest anchor to the cursor, and a
 * close-hint ring on the first anchor when the tool flags it as hot.
 *
 * Runs in screen space so anchor/handle sizes stay constant under zoom.
 * All world-space coords go through `worldToScreen` via the layer's `view`
 * argument.
 */

import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { Tool } from 'tools/types';
import type { PenScratch, PenAnchor, PenSubpath } from 'tools/builtin/usePenTool';
import { PATH_C, PATH_L, PATH_M, PATH_Z, type PolygonPath } from './types';
import { circlePath } from './markers';
import { renderPenEditOverlay } from './penEditOverlay';

export interface PenPreviewStyle {
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  rubberBandStroke?: string;
  closeHintFill?: string;
  finishedSubpathStroke?: string;
}

export interface CreatePenPreviewLayerOptions {
  /** The Tool returned by usePenTool. The layer reads its scratch via
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

// approximateCircle has moved to `./markers.ts` as `circlePath`. Re-exported
// locally so we don't rename callers in this file.
function approximateCircle(cx: number, cy: number, r: number): PolygonPath {
  return circlePath(cx, cy, r);
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
    draw: (_data, view) => {
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
            // Mirrored in-side handle preview — gives the user a full
            // through-anchor tangent so they can see the curve's incoming
            // shape as they drag. Suppressed when Alt-broken.
            const inSide = mirror(a, a.outHandle);
            if (inSide) {
              const [mx, my] = w2s(inSide.x, inSide.y, view);
              const mirrorLine: PolygonPath = {
                kind: 'polygon',
                commands: new Uint8Array([PATH_M, PATH_L]),
                coords: new Float32Array([ax, ay, mx, my]),
                fillRule: 'nonzero',
              };
              out.push({
                kind: 'path',
                path: mirrorLine,
                stroke: { paint: { fill: 'solid', color: style.handleStroke }, width: 1 },
              });
              out.push({
                kind: 'path',
                path: approximateCircle(mx, my, HANDLE_DOT_RADIUS_PX),
                fill: { fill: 'solid', color: style.handleStroke },
              });
            }
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

      // (6) Edit-mode overlay — anchor squares + handles for selected anchors.
      if (s.mode === 'edit') {
        out.push(...renderPenEditOverlay(s, view));
      }

      return out;
    },
  };
}
