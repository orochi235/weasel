import { ellipsePath } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { WidthFocus } from './widthActions';

const DOT_RADIUS_PX = 3.5;
const RIM = '#10161d';
const SET = '#ffffff';
const UNSET = '#8a94a3';
const RING = { paint: { color: '#2f80ed' }, width: 1 };

const circle = (x: number, y: number, r: number) => ellipsePath({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });

/**
 * A screen-space layer marking the anchors of the stroke the width tool last
 * touched: a dot on each, white where it has a width of its own, and a ring
 * as wide as that width around it.
 */
export function createWidthOverlay(source: {
  focus(): WidthFocus | null;
  subscribe(fn: () => void): () => void;
}): RenderLayer<unknown> {
  return {
    id: 'width-tool-anchors',
    label: 'Width anchors',
    space: 'screen',
    subscribe: source.subscribe,
    draw: (_data, view) => {
      const focus = source.focus();
      if (!focus) return [];
      const m = viewToTransform(view);
      const scale = (Math.abs(view.scale.x) + Math.abs(view.scale.y)) / 2;
      const rings: DrawCommand[] = [];
      const dots: DrawCommand[] = [];
      focus.anchors.forEach((a, i) => {
        const [x, y] = worldToScreen(a.x, a.y, m);
        const w = focus.widths[i];
        const set = typeof w === 'number' && Number.isFinite(w);
        if (set) rings.push({ kind: 'path', path: circle(x, y, (w * scale) / 2), stroke: RING });
        dots.push({
          kind: 'path',
          path: circle(x, y, DOT_RADIUS_PX),
          fill: { paint: { kind: 'solid', color: set ? SET : UNSET } },
          stroke: { paint: { color: RIM }, width: 1 },
        });
      });
      return [...rings, ...dots];
    },
  };
}
