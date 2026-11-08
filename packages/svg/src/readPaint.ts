/** Reading an element's fill and stroke off the cascade. */

import type { SvgPaint, SvgStroke } from './types';
import type { Fill, Paint, Stroke } from '@weasel-js/core';
import type { GradientTable } from './gradients';
import { ownProp, ownValue, resolveCurrentColor, setsOwn, styleValue, type StyleContext } from './cascade';
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
        const a = paintAlpha(opacity, parsed.fallback.alpha);
        if (a != null) (flat as { opacity?: number }).opacity = a;
        return flat;
      }
      onWarn(`${attr} references unknown gradient #${parsed.id}`);
      return { kind: 'solid', color: defaultColor };
    }
    return { kind: 'gradient', paint: opacity != null ? { ...paint, opacity } : paint };
  }
  const out: SvgPaint = { kind: 'solid', color: parsed.color };
  const a = paintAlpha(opacity, parsed.alpha);
  if (a != null) (out as { opacity?: number }).opacity = a;
  return out;
}

/** A color's own alpha under `fill-opacity` / `stroke-opacity`: SVG multiplies them. */
function paintAlpha(opacity: number | undefined | null, alpha: number): number | undefined {
  if (opacity != null) return opacity * alpha;
  return alpha < 1 ? alpha : undefined;
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
  // The paint already carries `stroke-opacity`, times a color's own alpha.
  if (styleValue(style, 'stroke-opacity', onWarn) != null) {
    stroke.opacity = paint.kind === 'solid' ? paint.opacity : paint.paint.opacity;
  }
  const cap = styleValue(style, 'stroke-linecap', onWarn);
  if (cap) stroke.cap = cap;
  const join = styleValue(style, 'stroke-linejoin', onWarn);
  if (join) stroke.join = join;
  const dash = styleValue(style, 'stroke-dasharray', onWarn);
  if (dash) stroke.dash = dash;
  const dashOffset = styleValue(style, 'stroke-dashoffset', onWarn);
  if (dashOffset) stroke.dashOffset = dashOffset;
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
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
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
    if (ownProp(el, k) != null) out[k] = setsOwn(el, k) ? computed[k] : 'inherit';
  }
  return out;
}

/**
 * Lower an {@link SvgStroke} to the kit's `Stroke`, whose paint is a
 * `Paint` rather than an `SvgPaint`. Returns `undefined` for a stroke
 * that paints nothing, so callers can leave the field absent.
 */
export function coreStroke(stroke: SvgStroke | undefined): Stroke | undefined {
  const paint = stroke && corePaint(stroke.paint);
  if (!stroke || !paint) return undefined;
  const out: Stroke = { paint, width: stroke.width };
  if (stroke.cap) out.cap = stroke.cap;
  if (stroke.join) out.join = stroke.join;
  if (stroke.dash) out.dash = stroke.dash;
  if (stroke.dashOffset) out.dashOffset = stroke.dashOffset;
  if (stroke.miterLimit != null) out.miterLimit = stroke.miterLimit;
  if (stroke.align) out.align = stroke.align;
  if (stroke.markerStart) out.markerStart = stroke.markerStart;
  if (stroke.markerMid) out.markerMid = stroke.markerMid;
  if (stroke.markerEnd) out.markerEnd = stroke.markerEnd;
  return out;
}

/** An {@link SvgPaint} as the kit's `Paint`, or `null` for one that paints nothing. */
export function corePaint(paint: SvgPaint): Paint | null {
  if (paint.kind === 'gradient') return paint.paint;
  if (paint.kind === 'none') return null;
  return paint.opacity != null
    ? { kind: 'solid', color: paint.color, opacity: paint.opacity }
    : { kind: 'solid', color: paint.color };
}

/**
 * The fill a `<text>` or `<tspan>` paints with, as the runs model holds it:
 * `null` for `none`. Read off `style`, the element's computed cascade, so
 * `fill-opacity` and a color's own alpha come with it.
 */
export function coreTextFill(style: StyleContext, gradients: GradientTable, onWarn: (msg: string) => void): Fill | null {
  const paint = corePaint(readPaint(style, 'fill', '#000000', gradients, onWarn));
  return paint ? { paint } : null;
}
