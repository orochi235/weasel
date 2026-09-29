/**
 * Guides overlay — a screen-space render layer that draws each guide as a
 * thin line, projecting the guide's world offset through the active view.
 * A guide with a `span` draws as a segment over that span with a tick at each
 * end; one without spans the full canvas. It also draws equal-spacing gaps
 * (`SpacingGap`) as ticked segments labeled with their size.
 *
 * Guides are not scene objects; they live outside the scene and are managed
 * via `useGuides`. Pair with `guideSnapStrategy` (snap behavior) to keep
 * the visual guide and the snap target in lockstep.
 */

import { textCommandFromRuns, type DrawCommand, type RenderLayer, type Stroke } from '@weasel-js/core';
import { PATH_L, PATH_M, rectPath, type PolygonPath } from '@weasel-js/geom';
import type { Guide, SpacingGap } from './types';

/** Options for `createGuidesLayer`. */
export interface GuidesLayerOpts {
  /** Stable getter for the live guide list — typically `useGuides().getGuides`. */
  getGuides: () => readonly Guide[];
  /** Stable getter for the equal-spacing gaps to draw — typically what an
   *  alignment behavior's `setActiveGaps` last published. */
  getGaps?: () => readonly SpacingGap[];
  /** `'span'` (default) draws a guide that carries a `span` as a segment over
   *  it; `'full'` draws every guide across the whole canvas. */
  extent?: 'span' | 'full';
  /** Length in CSS px of the tick across each end of a segment. 0 for none.
   *  Default 6. */
  ticks?: number;
  /** Label each gap with its size: `true` (default) prints it rounded to a
   *  whole world unit, a function formats it, `false` omits the label. */
  gapLabels?: boolean | ((size: number) => string);
  /** Stroke width in CSS pixels. Default 1. */
  lineWidth?: number;
  /** Stroke color, and the gap labels' fill. Default a subtle blue. */
  color?: string;
  /** Gap marker color. Default `color`. */
  gapColor?: string;
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
const LABEL_FONT = { fontSize: 10 };
// No text measurer in a layer: a 10px digit advances about 6px.
const LABEL_CHAR_W = 6;
const LABEL_H = 14;
const LABEL_PAD_X = 4;

/** A straight segment from (x0, y0) to (x1, y1), with a tick of length `t`
 *  across each end. Screen px. */
function tickedSegment(x0: number, y0: number, x1: number, y1: number, t: number): PolygonPath {
  const h = t / 2;
  const vertical = x0 === x1;
  const ends = t <= 0 ? [] : vertical
    ? [x0 - h, y0, x0 + h, y0, x1 - h, y1, x1 + h, y1]
    : [x0, y0 - h, x0, y0 + h, x1, y1 - h, x1, y1 + h];
  const coords = [x0, y0, x1, y1, ...ends];
  const commands: number[] = [];
  for (let i = 0; i < coords.length; i += 4) commands.push(PATH_M, PATH_L);
  return {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
}

/** Build a `RenderLayer` that draws guide lines and spacing gaps in screen
 *  space, projected from world coordinates via the active view. */
export function createGuidesLayer(opts: GuidesLayerOpts): RenderLayer<unknown> {
  const lineWidth = opts.lineWidth ?? 1;
  const color = opts.color ?? DEFAULT_COLOR;
  const gapColor = opts.gapColor ?? color;
  const ticks = opts.ticks ?? 6;
  const spanned = (opts.extent ?? 'span') === 'span';
  const format = opts.gapLabels === false ? null
    : typeof opts.gapLabels === 'function' ? opts.gapLabels
    : (n: number) => String(Math.round(n));
  const stroke: Stroke = { paint: { fill: 'solid', color }, width: lineWidth };
  const gapStroke: Stroke = { paint: { fill: 'solid', color: gapColor }, width: lineWidth };

  return {
    id: opts.id ?? 'guides',
    label: opts.label ?? 'Guides',
    space: 'screen',
    draw: (_data, view, dims) => {
      const guides = opts.getGuides();
      const gaps = opts.getGaps?.() ?? [];
      if (guides.length === 0 && gaps.length === 0) return [];
      const sx = (x: number) => (x - view.x) * view.scale.x;
      const sy = (y: number) => (y - view.y) * view.scale.y;

      const out: DrawCommand[] = [];
      for (const g of guides) {
        const span = spanned ? g.span : undefined;
        if (g.axis === 'x') {
          const x = sx(g.offset);
          if (x < -lineWidth || x > dims.width + lineWidth) continue;
          const path = span
            ? tickedSegment(x, sy(span.min), x, sy(span.max), ticks)
            : tickedSegment(x, 0, x, dims.height, 0);
          out.push({ kind: 'path', path, stroke });
        } else {
          const y = sy(g.offset);
          if (y < -lineWidth || y > dims.height + lineWidth) continue;
          const path = span
            ? tickedSegment(sx(span.min), y, sx(span.max), y, ticks)
            : tickedSegment(0, y, dims.width, y, 0);
          out.push({ kind: 'path', path, stroke });
        }
      }

      for (const g of gaps) {
        const [x0, y0, x1, y1] = g.axis === 'x'
          ? [sx(g.min), sy(g.at), sx(g.max), sy(g.at)]
          : [sx(g.at), sy(g.min), sx(g.at), sy(g.max)];
        out.push({ kind: 'path', path: tickedSegment(x0, y0, x1, y1, ticks), stroke: gapStroke });
        if (format === null) continue;
        const text = format(g.max - g.min);
        const w = text.length * LABEL_CHAR_W + LABEL_PAD_X * 2;
        const left = (x0 + x1) / 2 - w / 2;
        const top = (y0 + y1) / 2 - LABEL_H / 2;
        out.push({ kind: 'path', path: rectPath(left, top, w, LABEL_H), fill: { fill: 'solid', color: gapColor } });
        out.push(textCommandFromRuns(
          left + LABEL_PAD_X,
          top + 2,
          [{ text, fill: { fill: 'solid', color: '#fff' } }],
          LABEL_FONT,
        ));
      }
      return out;
    },
  };
}
