/**
 * Screen-space render layer for path-editing chrome — anchor squares,
 * tangent lines, and control-point dots for a polygon path that is the
 * current edit target. Companion to the kit's `editAnchorsAction` /
 * `buildAffordanceAt` hit-test wiring: the gesture works without chrome,
 * but a human user needs to see what's hittable.
 *
 * The layer reads the live edit target each frame via the supplied
 * `getEditingId()` + `getPose(...)` thunks, resolving the path against the
 * drawing view's own previews. Returns `[]` when no editing target is set or
 * the target isn't a polygon — the layer never throws.
 *
 * Anchors render as small white-filled stroked squares — filled solid
 * when selected; control points as small filled circles connected to
 * their anchor by a thin stem line. This is the kit's only anchor
 * chrome; the pen tool's parallel overlay and `apps/draw`'s
 * mode-decoration painter both drew the same thing from different state
 * and have been removed.
 *
 * All coordinates are projected via `worldToScreen` so the marker sizes
 * stay constant regardless of zoom.
 */

import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import type { Path, PolygonPath } from './types';
import type { GesturePreviewSource } from 'canvas/gestureBounds';
import { previewSourcesFrom, isVisibleFrom } from 'canvas/drawEnvelope';
import { pathToAnchors } from './anchors';
import { circlePath, linePath, rectMarkerPath, squarePath } from './markers';

interface View { x: number; y: number; scale: { x: number; y: number } }

/** Options for `createPathEditingOverlayLayer`. Everything is read per frame,
 *  so the layer follows a changing edit target without being rebuilt. */
export interface CreatePathEditingOverlayLayerOptions {
  /** Returns the id of the polygon currently in anchor-edit mode, or null
   *  when no node is being edited. Read each frame so live selection /
   *  edit-target changes show up without re-creating the layer. */
  getEditingId(): string | null;
  /**
   * Returns the pose for an id, or null if the node has been deleted.
   * Non-polygon poses are tolerated (the layer no-ops on them).
   *
   * `previews` are the drawing view's in-flight preview surfaces, so an
   * anchor dragged in one panel does not move in the others. Resolve against
   * them before falling back to the committed pose.
   */
  getPose(id: string, previews: readonly GesturePreviewSource[]): Path | null;
  /** Flat indices of the selected anchors. Selected anchors render
   *  filled; unselected ones hollow — the standard vector-editor cue for
   *  "these are what the arrow keys and Delete will act on". Omit when
   *  the consumer has no anchor selection to show. */
  getSelectedAnchors?(): ReadonlySet<number>;
  /** In-flight anchor-marquee rect in world coords, or null. Drawn as a
   *  rubber band while `marqueeAnchorsAction` is dragging. */
  getMarquee?(): { x: number; y: number; width: number; height: number } | null;
  /** Optional styling overrides. */
  style?: PathEditingOverlayStyle;
}

/** Appearance of the anchor and handle markers. */
export interface PathEditingOverlayStyle {
  anchorSizePx?: number;
  handleDotRadiusPx?: number;
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  /** Fill of the control-point circle. Defaults to the handleStroke color
   *  at 50% alpha — keeps the marker readable but lets the underlying
   *  curve / background show through, which matches Figma's "translucent
   *  handle dot" idiom. */
  handleDotFill?: string;
  /** Fill of a selected anchor square. Defaults to the anchor stroke
   *  color, so selection reads as "the marker filled in". */
  anchorFillSelected?: string;
  /** Stroke of the marquee rubber band. */
  marqueeStroke?: string;
  /** Fill of the marquee rubber band. */
  marqueeFill?: string;
}

const DEFAULT_STYLE: Required<PathEditingOverlayStyle> = {
  anchorSizePx: 8,
  // Control-point markers were 2px radius (4px diameter) — too small to
  // grab reliably with a mouse and visually lost against the curve.
  // 5px radius (10px diameter) is closer to typical Figma / Illustrator.
  handleDotRadiusPx: 5,
  anchorFill: '#ffffff',
  anchorStroke: '#3478f6',
  handleStroke: '#7da7e8',
  // 50%-opacity handle-stroke color. #7da7e8 → rgba(125, 167, 232, 0.5).
  handleDotFill: 'rgba(125, 167, 232, 0.5)',
  anchorFillSelected: '#3478f6',
  marqueeStroke: '#3478f6',
  marqueeFill: 'rgba(52, 120, 246, 0.08)',
};

const EMPTY_SELECTION: ReadonlySet<number> = new Set();

function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

/** Render layer that draws the anchors and control handles of the path
 *  currently being anchor-edited. Draws nothing when no path is being
 *  edited. */
export function createPathEditingOverlayLayer(
  opts: CreatePathEditingOverlayLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };

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
      const pose = opts.getPose(id, previewSourcesFrom(data));
      if (!pose || pose.kind !== 'polygon') return [];

      const { anchors } = pathToAnchors(pose as PolygonPath);
      const selected = opts.getSelectedAnchors?.() ?? EMPTY_SELECTION;
      const out: DrawCommand[] = [];

      // Flat anchor index, incremented in walk order so it lines up with
      // `enumerateAnchors` — the same numbering the affordances and the
      // anchor selection use. See `anchorEdits` for why they agree.
      let flat = 0;
      for (const sub of anchors) {
        for (const a of sub) {
          const isSelected = selected.has(flat);
          flat++;
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
              fill: { fill: 'solid', color: style.handleDotFill },
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
              fill: { fill: 'solid', color: style.handleDotFill },
            });
          }

          // Anchor square — drawn on top.
          out.push({
            kind: 'path',
            path: squarePath(ax, ay, style.anchorSizePx),
            fill: {
              fill: 'solid',
              color: isSelected ? style.anchorFillSelected : style.anchorFill,
            },
            stroke: { paint: { fill: 'solid', color: style.anchorStroke }, width: 1 },
          });
        }
      }

      // Marquee rubber band, on top of everything.
      const marquee = opts.getMarquee?.();
      if (marquee) {
        const [mx, my] = w2s(marquee.x, marquee.y, view);
        const [mx2, my2] = w2s(marquee.x + marquee.width, marquee.y + marquee.height, view);
        out.push({
          kind: 'path',
          path: rectMarkerPath(mx, my, mx2 - mx, my2 - my),
          fill: { fill: 'solid', color: style.marqueeFill },
          stroke: { paint: { fill: 'solid', color: style.marqueeStroke }, width: 1 },
        });
      }

      return out;
    },
  };
}
