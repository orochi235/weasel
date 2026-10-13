/**
 * The painted tier: draws a cursor glyph into the scene when it is too big,
 * or too tied to the view, to be a CSS `url()` cursor.
 *
 * Screen-space: the glyph is chrome at the pointer, so it must not pan or zoom
 * with the camera. What *does* track the camera is a world-sized glyph's size,
 * and `view.scale` is read for that.
 */

import { GLYPHS } from '@weasel-js/cursor';
import {
  chromeLineWidthScale,
  cursorPaintMatrix,
  cursorPaintOps,
  cursorWorldSize,
} from '@weasel-js/cursor';
import type { CursorPaintOp } from '@weasel-js/cursor';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { pathFromD, type Path } from '@weasel-js/geom';
import type { PaintedCursorState } from '@weasel-js/cursor';

/** Layer id, so a consumer can order or hide it like any other. */
export const PAINTED_CURSOR_LAYER_ID = 'painted-cursor';

/** Handing the renderer the same `Path` object every frame lets its mesh cache hit. */
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
    ...(op.fill !== undefined ? { fill: { paint: { color: op.fill } } } : {}),
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

/**
 * A screen-space layer that draws the glyph `state` currently holds at the pointer,
 * or nothing when it holds none. `<Canvas>` mounts one over its own state already.
 */
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

      // A world-sized glyph holds its line weight in CSS px while its geometry
      // grows — a ring at a 400px radius drawn with scaled weight is a filled
      // blob. A single radius needs one scale factor, so average the axes.
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
