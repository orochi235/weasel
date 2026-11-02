/**
 * Screen-space preview layer for `useSpiroTool`: the curve solved through the
 * points placed so far and the cursor, a marker on each point shaped by its
 * kind, and a ring on the first point while a click there would close the
 * curve. Runs in screen space so markers keep their size under zoom.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { circlePath, spiroToPath, transformPath, viewWorldToScreen, type Affine, type PolygonPath, type SpiroPoint } from '@weasel-js/geom';
import type { RenderLayer } from '@weasel-js/core';
import { spiroMarker } from './spiroMarkers';

/** What the spiro tool has placed, as the preview reads it each frame. */
export interface SpiroPreviewState {
  points: readonly SpiroPoint[];
  /** Where the next point would go, or null while the pointer is away. */
  cursor: SpiroPoint | null;
  /** True while a click would close the curve on its first point. */
  closeHint: boolean;
}

/** Options for {@link createSpiroPreviewLayer}. */
export interface CreateSpiroPreviewLayerOptions {
  state: () => SpiroPreviewState;
  /** The color the curve and markers are drawn in. */
  color?: string;
}

const MARKER_PX = 8;
const CLOSE_HINT_PX = 8;

/** Render layer drawing the spiro tool's curve in progress; nothing while
 *  no point is placed. */
export function createSpiroPreviewLayer(opts: CreateSpiroPreviewLayerOptions): RenderLayer<unknown> {
  const color = opts.color ?? '#d4c4a8';
  const paint = { kind: 'solid' as const, color };
  return {
    id: 'spiroPreview',
    label: 'Spiro preview',
    space: 'screen',
    draw: (_data, view) => {
      const { points, cursor, closeHint } = opts.state();
      if (points.length === 0) return [];
      const out: DrawCommand[] = [];
      const through = cursor && !closeHint ? [...points, cursor] : [...points];
      if (through.length >= 2) {
        const { path } = spiroToPath([{ points: through, closed: closeHint }]);
        const toScreen: Affine = [view.scale.x, 0, 0, view.scale.y, -view.x * view.scale.x, -view.y * view.scale.y];
        out.push({ kind: 'path', path: transformPath(path, toScreen) as PolygonPath, stroke: { paint, width: 1 } });
      }
      const screen = points.map((p) => viewWorldToScreen(view, p));
      points.forEach((p, i) => {
        const path = spiroMarker(p.kind)(screen[i], MARKER_PX, screen[i - 1] ?? null, screen[i + 1] ?? null);
        out.push({ kind: 'path', path, fill: { paint }, stroke: { paint, width: 1 } });
      });
      if (closeHint) {
        out.push({ kind: 'path', path: circlePath(screen[0].x, screen[0].y, CLOSE_HINT_PX), stroke: { paint, width: 1.5 } });
      }
      return out;
    },
  };
}
