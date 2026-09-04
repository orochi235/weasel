/**
 * The painted tier: draws a cursor glyph into the scene when it is too big,
 * or too tied to the view, to be a CSS `url()` cursor.
 *
 * A layer rather than something each tool draws in its own overlay, because
 * the alternative is every tool re-wiring the same thing. Riding the layer
 * system also means anything that reaches the cursor pipeline through a layer
 * claim — a HUD widget's `cursorAt` — gets the painted tier without knowing
 * this exists.
 *
 * Screen-space: the glyph is chrome at the pointer, not content in the
 * document, so it must not pan or zoom with the camera. What *does* track the
 * camera is a world-sized glyph's size, and `view.scale` is read for that.
 */

import { GLYPHS } from '@weasel-js/cursor';
import {
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
} from '@weasel-js/cursor';
import type { CursorPaintOp } from '@weasel-js/cursor';
import type { DrawCommand, PathDrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { pathFromD } from 'features/paths/pathFromD';
import type { Path } from 'features/paths/types';
import type { PaintedCursorState } from './paintedCursorState';

/** Layer id, so a consumer can order or hide it like any other. */
export const PAINTED_CURSOR_LAYER_ID = 'painted-cursor';

/**
 * `d` strings are fixed by the glyph set, so the parse is done once per glyph
 * member for the life of the process. Handing the renderer the same `Path`
 * object every frame also lets its own mesh cache hit.
 */
const pathCache = new Map<string, Path>();
function pathFor(d: string): Path {
  let p = pathCache.get(d);
  if (p === undefined) {
    p = pathFromD(d);
    pathCache.set(d, p);
  }
  return p;
}

function commandFor(op: CursorPaintOp): PathDrawCommand {
  return {
    kind: 'path',
    path: pathFor(op.d),
    ...(op.fill !== undefined ? { fill: { color: op.fill } } : {}),
    ...(op.stroke !== undefined
      ? {
          stroke: {
            paint: { color: op.stroke.color },
            width: op.stroke.width,
            cap: 'round' as const,
            join: 'round' as const,
          },
        }
      : {}),
  };
}

export function createPaintedCursorLayer(state: PaintedCursorState): RenderLayer<unknown> {
  return {
    id: PAINTED_CURSOR_LAYER_ID,
    label: 'Painted cursor',
    space: 'screen',
    draw: (_data, view) => {
      const frame = state.current();
      if (!frame) return [];
      const { cursor, at } = frame;
      const glyph = GLYPHS[cursor.glyph];
      if (!glyph) return [];

      // A world-sized glyph is measured against the live camera, and holds its
      // line weight in CSS px while its geometry grows — a ring at a 400px
      // radius drawn with scaled weight is a filled blob, not a cursor.
      // Radial, so a single radius needs one scale factor; average the axes.
      const scale = (view.scale.x + view.scale.y) / 2;
      const worldSized = cursor.worldRadius !== undefined;
      const size = worldSized
        ? cursorWorldSize(glyph, cursor.worldRadius as number, scale)
        : (cursor.size ?? 24);
      if (!(size > 0) || !Number.isFinite(size)) return [];

      const ops = cursorPaintOps(
        glyph,
        worldSized ? { lineWidthScale: chromeLineWidthScale(glyph, size) } : {},
      );
      const [a, b, c, d, e, f] = cursorPaintMatrix(glyph, {
        size,
        angle: cursor.angle,
        at,
      });
      // Column-major, the layout `Mat3` documents.
      const transform = new Float32Array([a, b, 0, c, d, 0, e, f, 1]);
      const children: DrawCommand[] = ops.map(commandFor);
      return [{ kind: 'group', transform, children }];
    },
  };
}
