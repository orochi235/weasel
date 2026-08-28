/** Kit-shipped default paint constants.
 *
 *  Single source of truth for the colors the built-in tools and the default
 *  fill/stroke actions reach for. Consumers that want to match the kit's
 *  out-of-the-box look (e.g. seed their own active-paint state) should import
 *  these rather than re-declaring the literals.
 *
 *  All values are `#rrggbbaa` so they round-trip through the kit's hex8 alpha
 *  helpers (`util/color`) without ambiguity.
 */
import type { FillStyle, Stroke } from '../core/paint-types';
import { getAlpha01 } from './color';

/** Default fill paint for shapes and the fill action — opaque white. */
export const DEFAULT_FILL_COLOR = '#ffffffff';

/** Default stroke paint for shapes and the stroke action — opaque black. */
export const DEFAULT_STROKE_COLOR = '#000000ff';

/** Default fill palette cycled through for auto-generated shape nodes
 *  (the kit's built-in shape tools and the `insert` action). */
export const DEFAULT_PALETTE: readonly string[] = [
  '#7fb069',
  '#d4a574',
  '#a48bd4',
  '#7ab8d4',
  '#d47a7a',
];

/** Preview / "ghost" stroke color used by drag-to-draw tool overlays and the
 *  selected-anchor highlight. Derived from the first palette entry so the
 *  preview chrome matches the default insert color. */
export const GHOST_STROKE: string = DEFAULT_PALETTE[0];

/**
 * A solid paint from a color string — the authoring shorthand for the one
 * shape a node's `data.fill` (and a `Stroke.paint`) may take.
 *
 * An alpha channel in `color` moves to `opacity`, because that is where every
 * paint kind carries its alpha; leaving it in the hex too would multiply the
 * two in the renderer.
 */
export function solid(color: string): FillStyle {
  const a = getAlpha01(color);
  const rgb = color.length === 9 && color.startsWith('#') ? color.slice(0, 7) : color;
  return a === 1 ? { color: rgb } : { color: rgb, opacity: a };
}

/** A solid stroke of `color` at `width` world units. Authoring shorthand for
 *  `{ paint: solid(color), width }`. */
export function strokeOf(color: string, width = 1): Stroke {
  return { paint: solid(color), width };
}

/** A stroke painted with `paint` at `width` world units — `strokeOf`'s sibling
 *  for a gradient or pattern, which has no color to pass. */
export function strokeWith(paint: FillStyle, width = 1): Stroke {
  return { paint, width };
}

/** The kit's default node paint — what a shape with no declared fill paints. */
export const DEFAULT_SHAPE_FILL: FillStyle = { color: '#888' };

/**
 * The 0..1 alpha a paint paints at.
 *
 * Every paint kind carries its alpha in `opacity` — that is the one slot a
 * gradient or a pattern has, so it is the slot all of them use.
 */
export function paintAlpha(paint: FillStyle | undefined): number {
  return paint?.opacity ?? 1;
}

/** `paint` painting at `alpha01` (clamped to 0..1). */
export function paintWithAlpha(paint: FillStyle, alpha01: number): FillStyle {
  return { ...paint, opacity: Math.max(0, Math.min(1, alpha01)) };
}

/**
 * `paint` recolored to `color`, keeping everything else about it.
 *
 * A solid paint takes the new color; a gradient or a pattern has no single
 * color to replace, so it is superseded by a solid one — picking a color off
 * a swatch means "paint this color". An alpha channel in `color` wins;
 * without one, the paint's existing opacity carries over.
 */
export function paintWithColor(paint: FillStyle | undefined, color: string): FillStyle {
  const next = solid(color);
  const explicitAlpha = color.length === 9 && color.startsWith('#');
  if (explicitAlpha || paint === undefined) return next;
  const alpha = paintAlpha(paint);
  return alpha === 1 ? next : { ...next, opacity: alpha };
}
