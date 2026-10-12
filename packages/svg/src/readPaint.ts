/** Reading an element's fill and stroke off the cascade. */

import type { SvgPaint, SvgStroke } from './types';
import type { Paint, Stroke } from '@weasel-js/core';
import type { GradientTable } from './gradients';
import { ownProp, ownValue, resolveCurrentColor, styleValue, type StyleContext } from './cascade';
import { readProperty, type InheritedPropertyName } from './properties';

export function readPaint(
  style: StyleContext,
  attr: 'fill' | 'stroke',
  defaultColor: string,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
): SvgPaint {
  const raw = resolveCurrentColor(style[attr] ?? null, style);
  const opacity = styleValue(style, `${attr}-opacity`, onWarn);
  if (raw == null) {
    if (attr === 'stroke') return { kind: 'none' };
    const out: SvgPaint = { kind: 'solid', color: defaultColor };
    if (opacity != null) (out as { opacity?: number }).opacity = opacity;
    return out;
  }
  const parsed = readProperty(attr, raw, onWarn);
  if (!parsed) {
    onWarn(`unrecognized ${attr} value: ${raw}`);
    return { kind: 'solid', color: defaultColor };
  }
  // Outside a marker there is no context element, and SVG paints `none`.
  if (parsed.kind === 'none' || parsed.kind === 'context') return { kind: 'none' };
  if (parsed.kind === 'ref') {
    const paint = gradients.get(parsed.id);
    if (!paint) {
      // A fallback color beside the reference is the author saying what to
      // paint when it cannot be resolved, so taking it is the documented
      // behavior rather than a recovery — nothing to warn about.
      if (parsed.fallback) {
        const flat: SvgPaint = { kind: 'solid', color: parsed.fallback.color };
        const a = opacity ?? (parsed.fallback.alpha < 1 ? parsed.fallback.alpha : undefined);
        if (a != null) (flat as { opacity?: number }).opacity = a;
        return flat;
      }
      onWarn(`${attr} references unknown gradient #${parsed.id}`);
      return { kind: 'solid', color: defaultColor };
    }
    return { kind: 'gradient', paint: opacity != null ? { ...paint, opacity } : paint };
  }
  const out: SvgPaint = { kind: 'solid', color: parsed.color };
  const a = opacity ?? (parsed.alpha < 1 ? parsed.alpha : undefined);
  if (a != null) (out as { opacity?: number }).opacity = a;
  return out;
}

export function readStroke(
  style: StyleContext,
  gradients: GradientTable,
  onWarn: (msg: string) => void,
  nonScaling = false,
): SvgStroke | undefined {
  const inheritedStroke = style['stroke'] ?? null;
  const inheritedWidth = style['stroke-width'] ?? null;
  if (inheritedStroke == null && inheritedWidth == null) return undefined;
  const paint = readPaint(style, 'stroke', '#000000', gradients, onWarn);
  if (paint.kind === 'none') return undefined;
  const n = styleValue(style, 'stroke-width', onWarn) ?? 1;
  const stroke: SvgStroke = { paint, width: nonScaling ? { px: n } : n };
  const opacity = styleValue(style, 'stroke-opacity', onWarn);
  if (opacity != null) stroke.opacity = opacity;
  const cap = styleValue(style, 'stroke-linecap', onWarn);
  if (cap) stroke.cap = cap;
  const join = styleValue(style, 'stroke-linejoin', onWarn);
  if (join) stroke.join = join;
  const dash = styleValue(style, 'stroke-dasharray', onWarn);
  if (dash) stroke.dash = dash;
  const miterLimit = styleValue(style, 'stroke-miterlimit', onWarn);
  if (miterLimit != null) stroke.miterLimit = miterLimit;
  for (const [attr, field] of [
    ['marker-start', 'markerStart'],
    ['marker-mid', 'markerMid'],
    ['marker-end', 'markerEnd'],
  ] as const) {
    // An id with no registered entry stays as-is for `ingestMarkers`, which
    // reads the document's own `<marker>` once the tree is built.
    const id = styleValue(style, attr, onWarn);
    if (id) stroke[field] = id;
  }
  return stroke;
}

/**
 * The stroke keys `readStroke` consults, collected off one element's own
 * attributes rather than the inherited cascade.
 *
 * A `<tspan>` inherits its parent `<text>`'s stroke per the SVG cascade, but
 * the runs model resolves a run's stroke against the node's already — so
 * lifting an inherited value onto the run would write the same paint twice
 * and make an unstyled run look deliberately styled.
 */
const STROKE_KEYS: readonly InheritedPropertyName[] = [
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit',
  'marker-start', 'marker-mid', 'marker-end',
];

/** Whether this element pins its stroke width to rendered pixels.
 *
 *  Read off the element rather than the cascade: `vector-effect` is one of the
 *  few presentation attributes SVG does not inherit, so a `<g>` carrying it
 *  must not hand it to its children. */
export function isNonScalingStroke(el: Element): boolean {
  return ownValue(el, 'vector-effect') === 'non-scaling-stroke';
}

export function ownStrokeStyle(el: Element, computed: StyleContext): StyleContext {
  const out: Partial<Record<InheritedPropertyName, string>> = {};
  for (const k of STROKE_KEYS) {
    const v = ownProp(el, k);
    if (v != null) out[k] = v === 'inherit' ? v : computed[k];
  }
  return out;
}

/**
 * Lower an {@link SvgStroke} to the kit's `Stroke`, whose paint is a
 * `Paint` rather than an `SvgPaint`. Returns `undefined` for a stroke
 * that paints nothing, so callers can leave the field absent.
 */
export function coreStroke(stroke: SvgStroke | undefined): Stroke | undefined {
  if (!stroke) return undefined;
  let paint: Paint;
  if (stroke.paint.kind === 'gradient') {
    paint = stroke.paint.paint;
  } else if (stroke.paint.kind === 'solid') {
    paint = stroke.paint.opacity != null
      ? { fill: 'solid', color: stroke.paint.color, opacity: stroke.paint.opacity }
      : { fill: 'solid', color: stroke.paint.color };
  } else {
    return undefined;
  }
  const out: Stroke = { paint, width: stroke.width };
  if (stroke.cap) out.cap = stroke.cap;
  if (stroke.join) out.join = stroke.join;
  if (stroke.dash) out.dash = stroke.dash;
  if (stroke.miterLimit != null) out.miterLimit = stroke.miterLimit;
  if (stroke.markerStart) out.markerStart = stroke.markerStart;
  if (stroke.markerMid) out.markerMid = stroke.markerMid;
  if (stroke.markerEnd) out.markerEnd = stroke.markerEnd;
  return out;
}
