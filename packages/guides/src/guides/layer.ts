/**
 * Guides overlay — a screen-space render layer that draws each guide as a
 * thin line, projecting the guide's world offset through the active view.
 * A guide with a `span` draws as a segment over that span with a tick at each
 * end; one without spans the full canvas. It also draws equal-spacing gaps
 * (`SpacingGap`) as ticked segments labeled with their size.
 *
 * Guides are not scene objects; they live outside the scene and are managed
 * via `useGuides`. Pair with `guideSnapSource` (snap source) to keep
 * the visual guide and the snap target in lockstep.
 */

import { measuredSegmentCommands, tickedSegment, viewWorldToScreen, type DrawCommand, type RenderLayer, type CommandStroke } from '@weasel-js/core';
import type { Guide, SpacingGap } from './types';

/** Options for `createGuidesLayer`. */
export interface GuidesLayerOpts {
  /** Stable getter for the live guide list — typically `useGuides().getGuides`. */
  getGuides: () => readonly Guide[];
  /** Stable getter for the equal-spacing gaps to draw, such as
   *  `matchSpacing`'s. */
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
  const stroke: CommandStroke = { paint: { kind: 'solid', color }, width: lineWidth };
  const gapStroke: CommandStroke = { paint: { kind: 'solid', color: gapColor }, width: lineWidth };

  return {
    id: opts.id ?? 'guides',
    label: opts.label ?? 'Guides',
    space: 'screen',
    draw: (_data, view, dims) => {
      const guides = opts.getGuides();
      const gaps = opts.getGaps?.() ?? [];
      if (guides.length === 0 && gaps.length === 0) return [];
      const out: DrawCommand[] = [];
      for (const g of guides) {
        const span = spanned ? g.span : undefined;
        if (g.axis === 'x') {
          const lo = viewWorldToScreen(view, { x: g.offset, y: span?.min ?? 0 });
          const x = lo.x;
          if (x < -lineWidth || x > dims.width + lineWidth) continue;
          const path = span
            ? tickedSegment(x, lo.y, x, viewWorldToScreen(view, { x: g.offset, y: span.max }).y, ticks)
            : tickedSegment(x, 0, x, dims.height, 0);
          out.push({ kind: 'path', path, stroke });
        } else {
          const lo = viewWorldToScreen(view, { x: span?.min ?? 0, y: g.offset });
          const y = lo.y;
          if (y < -lineWidth || y > dims.height + lineWidth) continue;
          const path = span
            ? tickedSegment(lo.x, y, viewWorldToScreen(view, { x: span.max, y: g.offset }).x, y, ticks)
            : tickedSegment(0, y, dims.width, y, 0);
          out.push({ kind: 'path', path, stroke });
        }
      }

      for (const g of gaps) {
        const a = viewWorldToScreen(view, g.axis === 'x' ? { x: g.min, y: g.at } : { x: g.at, y: g.min });
        const b = viewWorldToScreen(view, g.axis === 'x' ? { x: g.max, y: g.at } : { x: g.at, y: g.max });
        out.push(...measuredSegmentCommands(a.x, a.y, b.x, b.y, ticks, gapStroke, format?.(g.max - g.min) ?? null, gapColor));
      }
      return out;
    },
  };
}
