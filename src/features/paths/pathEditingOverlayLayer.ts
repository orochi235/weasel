/**
 * Screen-space render layer for path-editing chrome — anchor squares,
 * tangent lines, and control-point dots for a polygon path that is the
 * current edit target. Companion to the kit's `editAnchorsAction` /
 * `buildAffordanceAt` hit-test wiring: the gesture works without chrome,
 * but a human user needs to see what's hittable.
 *
 * The layer reads the live edit target each frame via the supplied
 * `getEditingId()` + `getPose(id)` thunks. Returns `[]` when no editing
 * target is set or the target isn't a polygon — the layer never throws.
 *
 * Visual treatment matches `penEditOverlay.ts` so the two overlays look
 * consistent: anchors render as small white-filled stroked squares;
 * control points as small filled circles connected to their anchor by a
 * thin stem line.
 *
 * All coordinates are projected via `worldToScreen` so the marker sizes
 * stay constant regardless of zoom.
 */

import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { Path, PolygonPath } from './types';
import { pathToAnchors } from './anchors';
import { circlePath, linePath, squarePath } from './markers';

interface View { x: number; y: number; scale: { x: number; y: number } }

export interface CreatePathEditingOverlayLayerOptions {
  /** Returns the id of the polygon currently in anchor-edit mode, or null
   *  when no node is being edited. Read each frame so live selection /
   *  edit-target changes show up without re-creating the layer. */
  getEditingId(): string | null;
  /** Returns the pose for an id, or null if the node has been deleted.
   *  Non-polygon poses are tolerated (the layer no-ops on them). */
  getPose(id: string): Path | null;
  /** Optional styling overrides. Defaults match `penEditOverlay`. */
  style?: PathEditingOverlayStyle;
}

export interface PathEditingOverlayStyle {
  anchorSizePx?: number;
  handleDotRadiusPx?: number;
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
}

const DEFAULT_STYLE: Required<PathEditingOverlayStyle> = {
  anchorSizePx: 6,
  handleDotRadiusPx: 2,
  anchorFill: '#ffffff',
  anchorStroke: '#3478f6',
  handleStroke: '#7da7e8',
};

function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

export function createPathEditingOverlayLayer(
  opts: CreatePathEditingOverlayLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };

  return {
    id: 'path-editing-overlay',
    label: 'Path editing',
    space: 'screen',
    draw: (_data, view) => {
      const id = opts.getEditingId();
      if (!id) return [];
      const pose = opts.getPose(id);
      if (!pose || pose.kind !== 'polygon') return [];

      const { anchors } = pathToAnchors(pose as PolygonPath);
      const out: DrawCommand[] = [];

      for (const sub of anchors) {
        for (const a of sub) {
          const [ax, ay] = w2s(a.x, a.y, view);

          // Tangent stems + handle dots first so the anchor square paints on top.
          if (a.inHandle) {
            const [hx, hy] = w2s(a.inHandle.x, a.inHandle.y, view);
            out.push({
              kind: 'path',
              path: linePath(ax, ay, hx, hy),
              stroke: { paint: { fill: 'solid', color: style.handleStroke }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, style.handleDotRadiusPx),
              fill: { fill: 'solid', color: style.handleStroke },
            });
          }
          if (a.outHandle) {
            const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
            out.push({
              kind: 'path',
              path: linePath(ax, ay, hx, hy),
              stroke: { paint: { fill: 'solid', color: style.handleStroke }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, style.handleDotRadiusPx),
              fill: { fill: 'solid', color: style.handleStroke },
            });
          }

          // Anchor square — drawn on top.
          out.push({
            kind: 'path',
            path: squarePath(ax, ay, style.anchorSizePx),
            fill: { fill: 'solid', color: style.anchorFill },
            stroke: { paint: { fill: 'solid', color: style.anchorStroke }, width: 1 },
          });
        }
      }

      return out;
    },
  };
}
