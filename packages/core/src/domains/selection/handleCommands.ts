/**
 * The selection overlay's resize handles: their style, where the kit puts
 * them, and the commands that paint them.
 */

import type { DrawCommand, GlMat3 } from '@weasel-js/renderer';
import { alignedStrokeRect, type CommandStroke, type CommandFill } from '@weasel-js/paint';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import { screenAngleOf } from '@weasel-js/geom';
import { angleOf, localToWorld, targetTransformOf } from 'core/geometry/targetFrame';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { HANDLE_BASE_PX } from 'core/device/targets';
import {
  handlePoint, resizeHandlesFor, type ResizeHandleLayout,
} from 'interactions/actions/resize/cornerHandles';

export type { ResizeHandleLayout };

const DEFAULT_HANDLE_FILL: CommandFill = { paint: { kind: 'solid', color: '#d4c4a8' } };
const DEFAULT_HANDLE_OUTLINE: CommandStroke = {
  paint: { kind: 'solid', color: '#1a130d' },
  width: 1,
};
const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;


/** Handle visuals, as a consumer supplies them. */
export interface SelectionHandleStyle {
  size?: number;
  fill?: CommandFill;
  outline?: CommandStroke;
}

export interface ResolvedHandles {
  size: number;
  fill: CommandFill;
  outline: CommandStroke;
}

export function resolveHandles(opts?: SelectionHandleStyle): ResolvedHandles {
  return {
    size: opts?.size ?? DEFAULT_HANDLE_SIZE,
    fill: opts?.fill ?? DEFAULT_HANDLE_FILL,
    outline: opts?.outline ?? DEFAULT_HANDLE_OUTLINE,
  };
}

/** GL helper: emit a closed rect path (kind:'rect'). */
export function rectPathFor(x: number, y: number, width: number, height: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  return { kind: 'rect', x, y, width, height };
}

/**
 * GL helper: build the matrix `translate(cx, cy) * rotate(θ) * translate(-cx, -cy)`
 * used to wrap rotated outline / handle commands.
 */
function rotateAroundMat3(cx: number, cy: number, theta: number): GlMat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // Composed in column-major (matches mat3 helpers): T(cx,cy) · R(θ) · T(-cx,-cy).
  // After expansion: a=c, b=s, c'=-s, d=c, tx=cx - c*cx + s*cy, ty=cy - s*cx - c*cy.
  const tx = cx - c * cx + s * cy;
  const ty = cy - s * cx - c * cy;
  return new Float32Array([
    c, s, 0,
    -s, c, 0,
    tx, ty, 1,
  ]) as GlMat3;
}

/** GL helper: emit handle fill+stroke commands for one bounds entry. */
export function handleCommandsFor(
  ids: readonly string[],
  resolveBounds: (id: string) => Bounds | null,
  handles: ResolvedHandles,
  handlesOf: ((b: Bounds) => { x: number; y: number }[]) | undefined,
  layoutOpts: Partial<ResizeHandleLayout> | undefined,
  view: View,
): DrawCommand[] {
  const layout: ResizeHandleLayout = { edges: true, hitRadiusPx: HANDLE_BASE_PX, ...layoutOpts };
  const out: DrawCommand[] = [];
  const half = handles.size / 2;
  const handleAlign = handles.outline.align ?? 'center';
  const handleWidth = resolveStrokeWidth(handles.outline.width ?? 1, 1);
  for (const id of ids) {
    const worldB = resolveBounds(id);
    if (!worldB) continue;
    // Framed in world, then projected: turning the projected point instead
    // lands somewhere else under non-uniform zoom.
    const xf = targetTransformOf(worldB);
    const t = viewToTransform(view);
    const angle = screenAngleOf(angleOf(xf), view.scale);
    const at = handlesOf
      ? handlesOf(worldB)
      : resizeHandlesFor(layout, worldB, xf, view.scale).map((c) => handlePoint(worldB, c));
    for (const hLocal of at) {
      const hWorld = localToWorld(xf, hLocal.x, hLocal.y);
      const [hsx, hsy] = worldToScreen(hWorld.x, hWorld.y, t);
      const center = { x: hsx, y: hsy };
      const baseRect = {
        x: center.x - half,
        y: center.y - half,
        width: handles.size,
        height: handles.size,
      };
      const sr = alignedStrokeRect(baseRect, handleAlign, handleWidth);
      const fillCmd: DrawCommand = {
        kind: 'path',
        path: rectPathFor(baseRect.x, baseRect.y, baseRect.width, baseRect.height),
        fill: handles.fill,
      };
      const strokeCmd: DrawCommand = {
        kind: 'path',
        path: rectPathFor(sr.x, sr.y, sr.width, sr.height),
        stroke: handles.outline,
      };
      if (angle === 0) {
        out.push(fillCmd, strokeCmd);
      } else {
        out.push({
          kind: 'group',
          transform: rotateAroundMat3(center.x, center.y, angle),
          children: [fillCmd, strokeCmd],
        });
      }
    }
  }
  return out;
}
