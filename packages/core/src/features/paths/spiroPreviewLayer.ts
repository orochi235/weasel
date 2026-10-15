/**
 * Screen-space preview layer for `useSpiroTool`: the curve solved through the
 * points placed so far and the cursor, a marker on each point shaped by its
 * kind, and a ring on the first point while a click there would close the
 * curve. Runs in screen space so markers keep their size under zoom.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import {
  circlePath, polygonFromPoints, spiroToPath, squarePath, transformPath,
  type Affine, type PolygonPath, type SpiroKind, type SpiroPoint,
} from '@weasel-js/geom';
import type { RenderLayer } from 'core/layers/render';

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

const MARKER_PX = 4;
const CLOSE_HINT_PX = 8;

/** A point's marker: a circle for a smooth point, a square for a corner, and
 *  a triangle pointing along the line for a point beside one. */
function marker(kind: SpiroKind, x: number, y: number): PolygonPath {
  const r = MARKER_PX;
  if (kind === 'smooth') return circlePath(x, y, r);
  if (kind === 'corner') return squarePath(x, y, r * 1.6);
  const dir = kind === 'left' ? -1 : 1;
  return polygonFromPoints([
    { x: x + dir * r, y: y - r }, { x: x + dir * r, y: y + r }, { x: x - dir * r, y },
  ]);
}

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
      const sx = (p: { x: number; y: number }) => (p.x - view.x) * view.scale.x;
      const sy = (p: { x: number; y: number }) => (p.y - view.y) * view.scale.y;
      const out: DrawCommand[] = [];
      const through = cursor && !closeHint ? [...points, cursor] : [...points];
      if (through.length >= 2) {
        const { path } = spiroToPath([{ points: through, closed: closeHint }]);
        const toScreen: Affine = [view.scale.x, 0, 0, view.scale.y, -view.x * view.scale.x, -view.y * view.scale.y];
        out.push({ kind: 'path', path: transformPath(path, toScreen) as PolygonPath, stroke: { paint, width: 1 } });
      }
      for (const p of points) {
        out.push({ kind: 'path', path: marker(p.kind, sx(p), sy(p)), fill: { paint }, stroke: { paint, width: 1 } });
      }
      if (closeHint) {
        out.push({ kind: 'path', path: circlePath(sx(points[0]), sy(points[0]), CLOSE_HINT_PX), stroke: { paint, width: 1.5 } });
      }
      return out;
    },
  };
}
