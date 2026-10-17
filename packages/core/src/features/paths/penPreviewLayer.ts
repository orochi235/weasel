/**
 * Screen-space preview layer for `usePenTool`. Reads the pen's state each
 * frame and renders the in-progress path: finished
 * subpaths (faded), the current subpath (bright + anchor dots + handles),
 * a rubber-band segment from the latest anchor to the cursor, and a
 * close-hint ring on the first anchor when the tool flags it as hot.
 *
 * Runs in screen space so anchor/handle sizes stay constant under zoom.
 * All world-space coords go through `worldToScreen` via the layer's `view`
 * argument.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import type { KitSettingsStore } from '@weasel-js/react';
import type { PenScratch, PenAnchor, PenSubpath } from 'tools/builtin/pen';
import { PATH_C, PATH_L, PATH_M, type PolygonPath, anchorsToPath, circlePath } from '@weasel-js/geom';

/** Appearance of the pen tool's in-progress path. */
export interface PenPreviewStyle {
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  rubberBandStroke?: string;
  closeHintFill?: string;
  finishedSubpathStroke?: string;
}

/** Options for `createPenPreviewLayer`. */
export interface CreatePenPreviewLayerOptions {
  /** The pen's state. One object for the pen's life, changed in place, so
   *  the layer reads the same one on every frame. */
  state: PenScratch;
  style?: PenPreviewStyle;
  /** The kit settings whose `targets.pen*RadiusPx` size the dots, read each frame. */
  kitSettings?: () => KitSettingsStore;
}

const DEFAULT_STYLE: Required<PenPreviewStyle> = {
  anchorFill: '#d4c4a8',
  anchorStroke: '#d4c4a8',
  handleStroke: '#d4c4a8',
  rubberBandStroke: '#d4c4a8',
  closeHintFill: '#d4c4a8',
  finishedSubpathStroke: '#8a7a5e',
};

export const ANCHOR_RADIUS_PX = 4;
export const HANDLE_DOT_RADIUS_PX = 3;
export const CLOSE_HINT_RADIUS_PX = 8;

/** How near the pen's first anchor, in screen px, a click closes the subpath. */
export const PEN_CLOSE_HIT_PX = 8;
/** How near another path's anchor, in screen px, a placed anchor lands on it. */
export const PEN_ANCHOR_SNAP_PX = 8;

/** The pen's reach in screen px: its own option, else the kit setting, else the constant. */
export const penReachOf = (o: { closeHitRadius?: number; anchorSnapRadius?: number; kitSettings?: KitSettingsStore }) => ({
  close: o.closeHitRadius ?? o.kitSettings?.get('targets.penCloseHitPx') ?? PEN_CLOSE_HIT_PX,
  anchorSnap: o.anchorSnapRadius ?? o.kitSettings?.get('targets.penAnchorSnapPx') ?? PEN_ANCHOR_SNAP_PX,
});

const radiiOf = (kit: KitSettingsStore | undefined) => ({
  anchor: kit?.get('targets.penAnchorRadiusPx') ?? ANCHOR_RADIUS_PX,
  handleDot: kit?.get('targets.penHandleDotRadiusPx') ?? HANDLE_DOT_RADIUS_PX,
  closeHint: kit?.get('targets.penCloseHintRadiusPx') ?? CLOSE_HINT_RADIUS_PX,
});

function w2s(wx: number, wy: number, view: { x: number; y: number; scale: { x: number; y: number } }): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

// approximateCircle has moved to `./markers.ts` as `circlePath`. Re-exported
// locally so we don't rename callers in this file.
function approximateCircle(cx: number, cy: number, r: number): PolygonPath {
  return circlePath(cx, cy, r);
}

/** A pen subpath as a screen-space `PolygonPath`, segmented by the same rule
 *  the pen commits with. */
function subpathToPath(
  sp: PenSubpath,
  view: { x: number; y: number; scale: { x: number; y: number } },
): PolygonPath | null {
  if (sp.anchors.length === 0) return null;
  const pt = (p: { x: number; y: number }) => {
    const [x, y] = w2s(p.x, p.y, view);
    return { x, y };
  };
  const anchors = sp.anchors.map((a: PenAnchor) => ({
    ...pt(a),
    ...(a.inHandle ? { inHandle: pt(a.inHandle) } : {}),
    ...(a.outHandle ? { outHandle: pt(a.outHandle) } : {}),
  }));
  return anchorsToPath([anchors], [sp.closed]);
}

/** Render layer that draws the pen tool's path as it is being placed —
 *  committed anchors, the rubber band to the cursor, and the close hint. Draws
 *  nothing when the pen is idle. */
export function createPenPreviewLayer(
  opts: CreatePenPreviewLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };
  const s = opts.state;

  return {
    id: 'penPreview',
    label: 'Pen preview',
    space: 'screen',
    draw: (_data, view) => {
      const out: DrawCommand[] = [];
      const r = radiiOf(opts.kitSettings?.());
      // (1) Finished subpaths — faded outline.
      for (const sp of s.finishedSubpaths) {
        const path = subpathToPath(sp, view);
        if (path === null) continue;
        out.push({
          kind: 'path',
          path,
          stroke: { paint: { kind: 'solid', color: style.finishedSubpathStroke }, width: 1 },
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
            stroke: { paint: { kind: 'solid', color: style.rubberBandStroke }, width: 1 },
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
          stroke: { paint: { kind: 'solid', color: style.rubberBandStroke }, width: 1 },
        });
      }

      // (4) Anchor dots + handles.
      if (cur) {
        for (let i = 0; i < cur.anchors.length; i++) {
          const a = cur.anchors[i];
          const [ax, ay] = w2s(a.x, a.y, view);
          out.push({
            kind: 'path',
            path: approximateCircle(ax, ay, r.anchor),
            fill: { paint: { kind: 'solid', color: style.anchorFill } },
            stroke: { paint: { kind: 'solid', color: style.anchorStroke }, width: 1 },
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
              stroke: { paint: { kind: 'solid', color: style.handleStroke }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: approximateCircle(hx, hy, r.handleDot),
              fill: { paint: { kind: 'solid', color: style.handleStroke } },
            });
            const inSide = a.inHandle;
            if (inSide) {
              const [mx, my] = w2s(inSide.x, inSide.y, view);
              const inLine: PolygonPath = {
                kind: 'polygon',
                commands: new Uint8Array([PATH_M, PATH_L]),
                coords: new Float32Array([ax, ay, mx, my]),
                fillRule: 'nonzero',
              };
              out.push({
                kind: 'path',
                path: inLine,
                stroke: { paint: { kind: 'solid', color: style.handleStroke }, width: 1 },
              });
              out.push({
                kind: 'path',
                path: approximateCircle(mx, my, r.handleDot),
                fill: { paint: { kind: 'solid', color: style.handleStroke } },
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
            path: approximateCircle(fx, fy, r.closeHint),
            stroke: { paint: { kind: 'solid', color: style.closeHintFill }, width: 1.5 },
          });
        }
      }

      return out;
    },
  };
}
