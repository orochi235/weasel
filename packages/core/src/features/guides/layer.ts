/**
 * Guides overlay — a screen-space render layer that draws each guide as a
 * thin line spanning the full canvas, projecting the guide's world offset
 * through the active view.
 *
 * Guides are not scene objects; they live outside the scene and are managed
 * via `useGuides`. Pair with `guideSnapStrategy` (snap behavior) to keep
 * the visual guide and the snap target in lockstep.
 */

import type { DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { type Stroke } from 'core/paint-types';
import { PATH_L, PATH_M, type PolygonPath } from '../paths/types';
import type { Guide } from './types';

/** Options for `createGuidesLayer`. */
export interface GuidesLayerOpts {
  /** Stable getter for the live guide list — typically `useGuides().getGuides`. */
  getGuides: () => readonly Guide[];
  /** Stroke width in CSS pixels. Default 1. */
  lineWidth?: number;
  /** Stroke color. Default a subtle blue. */
  color?: string;
  /** Optional dash pattern (CSS px). Currently unused — reserved for future
   *  parity with chrome that supports dashes. */
  dash?: number[];
  /** Override the layer id. Useful if a consumer needs more than one
   *  guides-layer (e.g. user-guides vs. system-guides). */
  id?: string;
  /** Override the layer label. */
  label?: string;
}

const DEFAULT_COLOR = '#3aa0ff';

/** Build a `RenderLayer` that draws guide lines across the full canvas in
 *  screen space, projected from world offsets via the active view. */
export function createGuidesLayer(opts: GuidesLayerOpts): RenderLayer<unknown> {
  const lineWidth = opts.lineWidth ?? 1;
  const color = opts.color ?? DEFAULT_COLOR;
  const stroke: Stroke = {
    paint: { fill: 'solid', color },
    width: lineWidth,
  };

  return {
    id: opts.id ?? 'guides',
    label: opts.label ?? 'Guides',
    space: 'screen',
    draw: (_data, view, dims) => {
      const guides = opts.getGuides();
      if (guides.length === 0) return [];

      const out: DrawCommand[] = [];
      for (const g of guides) {
        if (g.axis === 'x') {
          // Vertical line at world x = offset → screen x = (offset - view.x) * scale.
          const sx = (g.offset - view.x) * view.scale.x;
          if (sx < -lineWidth || sx > dims.width + lineWidth) continue;
          const path: PolygonPath = {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_L]),
            coords: new Float32Array([sx, 0, sx, dims.height]),
            fillRule: 'nonzero',
          };
          out.push({ kind: 'path', path, stroke });
        } else {
          // Horizontal line at world y = offset → screen y = (offset - view.y) * scale.
          const sy = (g.offset - view.y) * view.scale.y;
          if (sy < -lineWidth || sy > dims.height + lineWidth) continue;
          const path: PolygonPath = {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_L]),
            coords: new Float32Array([0, sy, dims.width, sy]),
            fillRule: 'nonzero',
          };
          out.push({ kind: 'path', path, stroke });
        }
      }
      return out;
    },
  };
}
