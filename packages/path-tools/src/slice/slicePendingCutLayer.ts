import { OVERLAY_ROLE_STROKES, viewToTransform, worldToScreen } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/renderer';
import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import type { SliceLive, SliceScratch } from './slicePendingCut';

/** Screen-space layer drawing the knife's pending cut: its points as dots, and
 *  the line through them to the pointer. `vertexRadiusPx` is read each frame. */
export function createPendingCutLayer(
  scratch: SliceScratch,
  live: SliceLive,
  vertexRadiusPx: () => number,
): RenderLayer<unknown> {
  return {
    id: 'slice-pending-cut',
    label: 'Slice — pending cut',
    space: 'screen',
    subscribe: live.listen,
    draw: (_data, view) => {
      const pts = scratch.points;
      if (pts.length === 0) return [];
      const t = viewToTransform(view);
      const toScreen = (p: { x: number; y: number }) => {
        const [x, y] = worldToScreen(p.x, p.y, t);
        return { x, y };
      };
      const run = pts.map(toScreen);
      const at = live.pointer()?.get();
      if (at) run.push(toScreen(at.world));
      const stroke = OVERLAY_ROLE_STROKES['cut'];
      const r = vertexRadiusPx();
      const out: DrawCommand[] = [];
      if (run.length >= 2) out.push({ kind: 'path', path: polylineFromPoints(run), stroke });
      for (const p of pts.map(toScreen)) {
        out.push({
          kind: 'path',
          path: ellipsePath({ x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 }),
          fill: { paint: stroke.paint },
        });
      }
      return out;
    },
  };
}
