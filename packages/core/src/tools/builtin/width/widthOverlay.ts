import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import { widthProfileAt } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { strokeSitesAt } from '@weasel-js/stroke';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { WidthFocus } from './widthActions';

const STOP_RADIUS_PX = 3.5;
const RIM = '#10161d';
const STOP = '#ffffff';
const SPAN = { paint: { color: '#2f80ed' }, width: 1 };

/**
 * A screen-space layer marking each stop of the focused stroke's profile: a
 * line across the stroke as wide as the stop makes it, and a dot on the
 * centerline, on every subpath.
 */
export function createWidthOverlay(source: {
  focus(): WidthFocus | null;
  subscribe(fn: () => void): () => void;
}): RenderLayer<unknown> {
  return {
    id: 'width-tool-stops',
    label: 'Width stops',
    space: 'screen',
    subscribe: source.subscribe,
    draw: (_data, view) => {
      const focus = source.focus();
      if (!focus) return [];
      const m = viewToTransform(view);
      const toScreen = (x: number, y: number) => {
        const [sx, sy] = worldToScreen(x, y, m);
        return { x: sx, y: sy };
      };
      const { target, profile } = focus;
      const spans: DrawCommand[] = [];
      const dots: DrawCommand[] = [];
      for (const stop of profile) {
        for (const at of strokeSitesAt(target.path, stop.t)) {
          const half = (target.base * widthProfileAt(profile, stop.t)) / 2;
          spans.push({
            kind: 'path',
            path: polylineFromPoints([
              toScreen(at.x - at.nx * half, at.y - at.ny * half),
              toScreen(at.x + at.nx * half, at.y + at.ny * half),
            ]),
            stroke: SPAN,
          });
          const c = toScreen(at.x, at.y);
          dots.push({
            kind: 'path',
            path: ellipsePath({
              x: c.x - STOP_RADIUS_PX, y: c.y - STOP_RADIUS_PX, width: 2 * STOP_RADIUS_PX, height: 2 * STOP_RADIUS_PX,
            }),
            fill: { paint: { kind: 'solid', color: STOP } },
            stroke: { paint: { color: RIM }, width: 1 },
          });
        }
      }
      return [...spans, ...dots];
    },
  };
}
