import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import { vertexHalfWidths } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import { viewToTransform, worldToScreen, type RenderLayer } from '@weasel-js/core';
import type { WidthFocus } from './widthActions';
import { isWidthSet } from './widthEdit';

const DOT_RADIUS_PX = 3.5;
const GRAB_RADIUS_PX = 4.5;
const RIM = '#10161d';
const SET = '#ffffff';
const UNSET = '#8a94a3';
const ACCENT = '#2f80ed';
const ACROSS = { paint: { color: ACCENT }, width: 1 };

const circle = (x: number, y: number, r: number) => ellipsePath({ x: x - r, y: y - r, width: 2 * r, height: 2 * r });
const line = (a: [number, number], b: [number, number]): DrawCommand => ({
  kind: 'path', path: polylineFromPoints([{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }]), stroke: ACROSS,
});

/**
 * A screen-space layer marking the width points of the stroke the width tool
 * last touched: a dot on each anchor, white where it has a width of its own,
 * with a line across the stroke from its left edge to its right. Over an
 * edge it adds the grab point on that edge, ringing the width point a press
 * there moves.
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
      const at = (x: number, y: number) => worldToScreen(x, y, m);
      const lines: DrawCommand[] = [];
      const dots: DrawCommand[] = [];
      focus.anchors.forEach((a, i) => {
        const set = isWidthSet(focus.widths[i]);
        if (set) {
          const { left, right } = vertexHalfWidths(focus.widths[i], focus.fallback);
          const n = focus.normals[i];
          lines.push(line(at(a.x - n.x * left, a.y - n.y * left), at(a.x + n.x * right, a.y + n.y * right)));
        }
        const [x, y] = at(a.x, a.y);
        dots.push({
          kind: 'path',
          path: circle(x, y, DOT_RADIUS_PX),
          fill: { paint: { kind: 'solid', color: set ? SET : UNSET } },
          stroke: { paint: { color: RIM }, width: 1 },
        });
      });
      const grab: DrawCommand[] = [];
      if (focus.grab) {
        const w = at(focus.grab.at.x, focus.grab.at.y);
        const e = at(focus.grab.edge.x, focus.grab.edge.y);
        grab.push(
          line(w, e),
          { kind: 'path', path: circle(w[0], w[1], GRAB_RADIUS_PX + 1.5), stroke: { paint: { color: ACCENT }, width: 1.5 } },
          {
            kind: 'path',
            path: circle(e[0], e[1], GRAB_RADIUS_PX),
            fill: { paint: { kind: 'solid', color: ACCENT } },
            stroke: { paint: { color: SET }, width: 1 },
          },
        );
      }
      return [...lines, ...dots, ...grab];
    },
  };
}
