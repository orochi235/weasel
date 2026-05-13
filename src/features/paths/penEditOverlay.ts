/**
 * Screen-space overlay for pen edit mode. Renders anchor squares and handle
 * stems + dots for selected anchors. Intended as a companion to
 * `penPreviewLayer.ts` — call `renderPenEditOverlay` at the end of the draw
 * function and spread the result into `out`.
 *
 * All coordinates are converted from world space to screen space exactly as
 * `penPreviewLayer.ts` does, so sizes stay constant under zoom.
 */

import type { DrawCommand } from '../../renderer';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from './types';
import type { PenScratch } from 'tools/builtin/useUserPenTool';

interface View { x: number; y: number; scale: number }

const ANCHOR_SIZE_PX = 6;
const HANDLE_DOT_RADIUS_PX = 2;
const ANCHOR_STROKE = '#3478f6';
const ANCHOR_FILL_SELECTED = '#3478f6';
const ANCHOR_FILL_UNSELECTED = '#ffffff';
const HANDLE_STROKE = '#7da7e8';

/** World → screen (mirrors `w2s` in penPreviewLayer.ts). */
function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale, (wy - view.y) * view.scale];
}

/** Filled square path centred at (cx, cy) with side length `size`. */
function buildSquareAt(cx: number, cy: number, size: number): PolygonPath {
  const half = size / 2;
  const x0 = cx - half, y0 = cy - half;
  const x1 = cx + half, y1 = cy + half;
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]),
    fillRule: 'nonzero',
  };
}

/** N-segment polygon approximation of a circle (mirrors penPreviewLayer's copy). */
function approximateCircle(cx: number, cy: number, r: number, segments = 24): PolygonPath {
  const cmds = new Uint8Array(segments + 1);
  const coords = new Float32Array(segments * 2);
  cmds[0] = PATH_M;
  coords[0] = cx + r;
  coords[1] = cy;
  for (let i = 1; i < segments; i++) {
    cmds[i] = PATH_L;
    const theta = (i / segments) * Math.PI * 2;
    coords[i * 2] = cx + r * Math.cos(theta);
    coords[i * 2 + 1] = cy + r * Math.sin(theta);
  }
  cmds[segments] = PATH_Z;
  return { kind: 'polygon', commands: cmds, coords, fillRule: 'nonzero' };
}

function lineCmd(ax: number, ay: number, bx: number, by: number, color: string): DrawCommand {
  return {
    kind: 'path',
    path: {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([ax, ay, bx, by]),
      fillRule: 'nonzero',
    },
    stroke: { paint: { fill: 'solid', color }, width: 1 },
  };
}

/**
 * Build the draw commands for the pen edit-mode overlay.
 *
 * For every anchor in `scratch.edit.anchors`:
 * - Renders a stroked square (filled blue when selected, white when not).
 * - For **selected** anchors only, also renders a stem line + circle dot for
 *   each handle that is present (`inHandle` / `outHandle`).
 *
 * Returns `[]` immediately when `scratch.mode !== 'edit'`.
 *
 * Output is in SCREEN space — the caller is responsible for placing this
 * inside a `space: 'screen'` render layer.
 */
export function renderPenEditOverlay(scratch: PenScratch, view: View): DrawCommand[] {
  if (scratch.mode !== 'edit' || !scratch.edit) return [];

  const out: DrawCommand[] = [];
  const { anchors, selectedAnchors } = scratch.edit;

  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      const [ax, ay] = w2s(a.x, a.y, view);
      const key = `${s}:${i}`;
      const selected = selectedAnchors.has(key);

      // Handle stems + dots — selected anchors only.
      if (selected) {
        if (a.inHandle) {
          const [hx, hy] = w2s(a.inHandle.x, a.inHandle.y, view);
          out.push(lineCmd(ax, ay, hx, hy, HANDLE_STROKE));
          out.push({
            kind: 'path',
            path: approximateCircle(hx, hy, HANDLE_DOT_RADIUS_PX),
            fill: { fill: 'solid', color: HANDLE_STROKE },
          });
        }
        if (a.outHandle) {
          const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
          out.push(lineCmd(ax, ay, hx, hy, HANDLE_STROKE));
          out.push({
            kind: 'path',
            path: approximateCircle(hx, hy, HANDLE_DOT_RADIUS_PX),
            fill: { fill: 'solid', color: HANDLE_STROKE },
          });
        }
      }

      // Anchor square — drawn last so it renders on top of handle geometry.
      out.push({
        kind: 'path',
        path: buildSquareAt(ax, ay, ANCHOR_SIZE_PX),
        fill: { fill: 'solid', color: selected ? ANCHOR_FILL_SELECTED : ANCHOR_FILL_UNSELECTED },
        stroke: { paint: { fill: 'solid', color: ANCHOR_STROKE }, width: 1 },
      });
    }
  }

  // Marquee rubber-band (drag on empty in edit mode).
  if (scratch.edit.marquee) {
    const m = scratch.edit.marquee;
    const [x0s, y0s] = w2s(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), view);
    const [x1s, y1s] = w2s(Math.max(m.x0, m.x1), Math.max(m.y0, m.y1), view);
    out.push({
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
        coords: new Float32Array([x0s, y0s, x1s, y0s, x1s, y1s, x0s, y1s]),
        fillRule: 'nonzero',
      },
      fill: { fill: 'solid', color: 'rgba(52, 120, 246, 0.08)' },
      stroke: { paint: { fill: 'solid', color: '#3478f6' }, width: 1 },
    });
  }

  return out;
}
