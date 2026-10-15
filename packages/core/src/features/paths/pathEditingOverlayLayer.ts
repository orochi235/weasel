/**
 * Screen-space render layer for path-editing chrome — the open path's
 * outline, anchor markers, tangent lines, and control-point dots for a
 * polygon path that is the current edit target. Marker sizes stay constant
 * regardless of zoom.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { type Path, type PolygonPath, type View, rectMarkerPath } from '@weasel-js/geom';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import { previewSourcesFrom, isVisibleFrom } from 'canvas/drawEnvelope';
import {
  anchorMarkerCommands, DEFAULT_OVERLAY_STYLE, worldToScreen, type PathEditingOverlayStyle,
} from './anchorMarkers';

export type { PathEditingOverlayStyle } from './anchorMarkers';

/** Options for `createPathEditingOverlayLayer`. Everything is read per frame,
 *  so the layer follows a changing edit target without being rebuilt. */
export interface CreatePathEditingOverlayLayerOptions {
  /** Returns the id of the polygon currently in anchor-edit mode, or null
   *  when no node is being edited. */
  getEditingId(): string | null;
  /**
   * Returns the pose for an id, or null if the node has been deleted.
   * Non-polygon poses are tolerated (the layer no-ops on them).
   *
   * `previews` are the drawing view's in-flight preview surfaces, so an
   * anchor dragged in one panel does not move in the others. Resolve against
   * them before falling back to the committed pose.
   *
   * `view` is the drawing view's camera. Answer in its world: a node whose
   * layer is a parallax plane stores its path in the plane's.
   */
  getPose(id: string, previews: readonly GesturePreviewSource[], view: View): Path | null;
  /** Flat indices of the selected anchors. Selected anchors render
   *  filled; unselected ones hollow. */
  getSelectedAnchors?(): ReadonlySet<number>;
  /** In-flight anchor-marquee rect in world coords, or null. Drawn as a
   *  rubber band while `marqueeAnchorsAction` is dragging. */
  getMarquee?(view: View): { x: number; y: number; width: number; height: number } | null;
  /** Optional styling overrides. */
  style?: PathEditingOverlayStyle;
}

const EMPTY_SELECTION: ReadonlySet<number> = new Set();

/** Render layer that draws the outline and the anchors and control handles
 *  of the path currently being anchor-edited. Draws nothing when no path is
 *  being edited. */
export function createPathEditingOverlayLayer(
  opts: CreatePathEditingOverlayLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_OVERLAY_STYLE, ...(opts.style ?? {}) };

  return {
    id: 'path-editing-overlay',
    label: 'Path editing',
    space: 'screen',
    draw: (data, view) => {
      const id = opts.getEditingId();
      if (!id) return [];
      // Chrome-caps gate off the envelope, so paint and the anchor hit-test in
      // `affordanceAt` consult the same rule — otherwise a consumer that hides
      // the chrome still gets grabbable invisible anchors, or vice versa.
      const isVisible = isVisibleFrom(data);
      if (isVisible && !isVisible('path-edit.anchors')) return [];
      const pose = opts.getPose(id, previewSourcesFrom(data), view);
      if (!pose || pose.kind !== 'polygon') return [];

      const selected = opts.getSelectedAnchors?.() ?? EMPTY_SELECTION;
      const out: DrawCommand[] = anchorMarkerCommands(pose as PolygonPath, view, selected, style);

      // Marquee rubber band, on top of everything.
      const marquee = opts.getMarquee?.(view);
      if (marquee) {
        const m = worldToScreen(marquee, view);
        const m2 = worldToScreen({ x: marquee.x + marquee.width, y: marquee.y + marquee.height }, view);
        out.push({
          kind: 'path',
          path: rectMarkerPath(m.x, m.y, m2.x - m.x, m2.y - m.y),
          fill: { paint: { kind: 'solid', color: style.marqueeFill } },
          stroke: { paint: { kind: 'solid', color: style.marqueeStroke }, width: 1 },
        });
      }

      return out;
    },
  };
}
