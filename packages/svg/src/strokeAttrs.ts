/** The paint, opacity, and stroke attributes every drawn element shares. */

import { escapeAttr } from './xmlEscape';
import { isSolidPaint, type Stroke, type StrokeAlign } from '@weasel-js/core';
import type { ScreenLength, SvgPaint, SvgStroke } from './types';
import { trimNumber } from './transform';
import type { PaintServerRegistry } from './gradients';

export type Warn = (message: string) => void;

/** SVG 1.1 has no stroke alignment; SVG 2's `stroke-alignment` never shipped
 *  in a browser. */
function warnStrokeAlign(align: StrokeAlign | undefined, warn: Warn): void {
  if (align && align !== 'center') {
    warn(`a stroke aligned "${align}" of its edge is written centered: SVG has no stroke alignment`);
  }
}

export function paintAttrs(
  paint: SvgPaint,
  name: 'fill' | 'stroke',
  registry: PaintServerRegistry,
  includeOpacity = true,
): string[] {
  if (paint.kind === 'none') return [`${name}="none"`];
  const out = [`${name}="${paint.kind === 'solid' ? escapeAttr(paint.color) : registry.ref(paint.paint)}"`];
  if (includeOpacity) out.push(...opacityAttr(`${name}-opacity`, svgPaintOpacity(paint)));
  return out;
}

/** A stroke's paint and opacity as `fill` attributes, for drawing its
 *  outline as a filled shape. */
export function strokePaintAsFillAttrs(stroke: SvgStroke, registry: PaintServerRegistry): string[] {
  return [
    ...paintAttrs(stroke.paint, 'fill', registry, false),
    ...opacityAttr('fill-opacity', stroke.opacity ?? svgPaintOpacity(stroke.paint)),
  ];
}

/** The opacity an `SvgPaint` carries, whichever kind holds it. */
function svgPaintOpacity(paint: SvgPaint): number | undefined {
  if (paint.kind === 'solid') return paint.opacity;
  return paint.kind === 'gradient' ? paint.paint.opacity : undefined;
}

/** `name="v"`, or nothing when `v` is absent or fully opaque. */
export function opacityAttr(name: string, v: number | undefined): string[] {
  return v != null && v !== 1 ? [`${name}="${trimNumber(v)}"`] : [];
}

/**
 * `stroke-width`, plus `vector-effect="non-scaling-stroke"` when the width is
 * in screen pixels: the number goes out unresolved, since resolving it would
 * bake a single zoom level into the document.
 */
function strokeWidthAttrs(width: ScreenLength): string[] {
  if (typeof width === 'number') return [`stroke-width="${trimNumber(width)}"`];
  return [`stroke-width="${trimNumber(width.px)}"`, 'vector-effect="non-scaling-stroke"'];
}

/**
 * Attributes for a kit `Stroke` — the shape text carries, whose `paint` is a
 * `Paint` rather than an `SvgPaint`. Absent, unpainted, or zero-width
 * emits nothing at all.
 */
export function coreStrokeAttrs(stroke: Stroke | undefined, registry: PaintServerRegistry, warn: Warn): string[] {
  const paint = stroke?.paint;
  if (!stroke || !paint) return [];
  const width = stroke.width ?? 1;
  if (!((typeof width === 'object' ? width.px : width) > 0)) return [];
  warnStrokeAlign(stroke.align, warn);
  const attrs: string[] = [`stroke="${isSolidPaint(paint) ? escapeAttr(paint.color) : registry.ref(paint)}"`];
  attrs.push(...opacityAttr('stroke-opacity', paint.opacity));
  attrs.push(...strokeWidthAttrs(width));
  if (stroke.cap) attrs.push(`stroke-linecap="${stroke.cap}"`);
  if (stroke.join) attrs.push(`stroke-linejoin="${stroke.join}"`);
  attrs.push(...dashAttrs(stroke));
  if (stroke.miterLimit != null) attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  attrs.push(...markerAttrs(stroke, registry, warn));
  return attrs;
}

/** `seat` says which ends of the element were cut back for their heads, which then take their seated defs. */
export function strokeAttrsFor(
  stroke: SvgStroke, registry: PaintServerRegistry, warn: Warn, seat?: { start: boolean; end: boolean },
): string[] {
  warnStrokeAlign(stroke.align, warn);
  // `SvgStroke.opacity` and the paint's own `opacity` are two models of one
  // SVG attribute, and parse fills in both. Emitting each would write
  // `stroke-opacity` twice, which is not well-formed XML.
  const attrs = paintAttrs(stroke.paint, 'stroke', registry, false);
  attrs.push(...strokeWidthAttrs(stroke.width));
  attrs.push(...opacityAttr('stroke-opacity', stroke.opacity ?? svgPaintOpacity(stroke.paint)));
  if (stroke.cap) {
    attrs.push(`stroke-linecap="${stroke.cap}"`);
  }
  if (stroke.join) {
    attrs.push(`stroke-linejoin="${stroke.join}"`);
  }
  attrs.push(...dashAttrs(stroke));
  if (stroke.miterLimit != null) {
    attrs.push(`stroke-miterlimit="${trimNumber(stroke.miterLimit)}"`);
  }
  attrs.push(...markerAttrs(stroke, registry, warn, seat));
  return attrs;
}

/** `stroke-dasharray` and `stroke-dashoffset`, the offset only beside a dash it moves. */
function dashAttrs(stroke: { dash?: readonly number[]; dashOffset?: number }): string[] {
  if (!stroke.dash || stroke.dash.length === 0) return [];
  const attrs = [`stroke-dasharray="${stroke.dash.map(trimNumber).join(' ')}"`];
  if (stroke.dashOffset && Number.isFinite(stroke.dashOffset)) {
    attrs.push(`stroke-dashoffset="${trimNumber(stroke.dashOffset)}"`);
  }
  return attrs;
}

/** `marker-*` attributes for the heads `stroke` names that the marker registry knows. */
function markerAttrs(
  stroke: Pick<Stroke, 'markerStart' | 'markerMid' | 'markerEnd'>, registry: PaintServerRegistry, warn: Warn,
  seat?: { start: boolean; end: boolean },
): string[] {
  const attrs: string[] = [];
  for (const [field, attr] of [
    ['markerStart', 'marker-start'],
    ['markerMid', 'marker-mid'],
    ['markerEnd', 'marker-end'],
  ] as const) {
    const ref = stroke[field];
    if (ref === undefined) continue;
    const seated = field === 'markerStart' ? seat?.start : field === 'markerEnd' ? seat?.end : false;
    const id = registry.markerId(ref, seated ?? false);
    if (id === undefined) {
      warn(`marker "${typeof ref === 'string' ? ref : ref.key}" is not registered, so the stroke is written without it`);
      continue;
    }
    attrs.push(`${attr}="url(#${id})"`);
  }
  return attrs;
}
