/**
 * What SVG gradients and weasel's gradient paints share in both directions —
 * the private namespace, the interpolation attribute — and the
 * `<linearGradient>` / `<radialGradient>` / `<wzl:conicGradient>` a gradient
 * paint is written as. Reading them back is `readGradients`.
 */

import { nativeSvgSpace } from '@weasel-js/paint-kinds';
import type { Paint, PaintUnits } from '@weasel-js/core';
import { stopsXml } from './gradientStops';
import { trimNumber } from './transform';

/**
 * The namespace weasel's own paint servers are written in, and the prefix they
 * are written under. A conic gradient has no SVG element to target — SVG has
 * `linearGradient` and `radialGradient` and nothing else — so it goes out as a
 * foreign-namespaced def that this package reads back and every other renderer
 * skips in favor of the paint fallback color beside the reference.
 *
 * A registered paint kind's own `toSvg` may use this prefix too: the root
 * declares it whenever any paint in the document lacks a native SVG form.
 */
export const WEASEL_NS = 'urn:weasel-js:svg';
export const WEASEL_NS_PREFIX = 'wzl';

/**
 * The spaces `interpolate` can name, as SVG spells them. SVG's own
 * `color-interpolation` carries `sRGB` and `linearRGB` only, so anything
 * perceptual goes out as a namespaced attribute a foreign renderer ignores —
 * which leaves it interpolating in sRGB. That is a shifted midpoint rather
 * than a lost paint, so these gradients keep their native element and take no
 * fallback color.
 */
const INTERPOLATE_SPACES = new Set(['rgb', 'oklab', 'oklch']);

/** The `wzl:interpolate` attribute a gradient needs, or `''` for the sRGB
 *  default every other renderer already assumes. */
function interpolateAttr(space: string | undefined): string {
  if (nativeSvgSpace(space)) return '';
  return ` ${WEASEL_NS_PREFIX}:interpolate="${space}"`;
}

/** Whether any gradient in the document names a space SVG cannot, so the root
 *  has to declare the namespace the attribute is written in. */
export function usesInterpolateAttr(paint: Paint): boolean {
  const space = (paint as { interpolate?: string }).interpolate;
  return !nativeSvgSpace(space) && INTERPOLATE_SPACES.has(space!);
}

/** `PaintUnits` → SVG `gradientUnits`. `'screen'` (the kit's default, and
 *  a viewport-fixed wash) has no SVG analog at all; it lowers to user space,
 *  which at least puts the paint somewhere the geometry is. */
function gradientUnitsAttr(units: PaintUnits | undefined): string {
  return units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse';
}

export function gradientXml(id: string, paint: Paint): string {
  if (paint.kind === 'linear-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
    return (
      `<linearGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `x1="${trimNumber(paint.from.x)}" y1="${trimNumber(paint.from.y)}" ` +
      `x2="${trimNumber(paint.to.x)}" y2="${trimNumber(paint.to.y)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</linearGradient>`
    );
  }
  if (paint.kind === 'conic-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
    const P = WEASEL_NS_PREFIX;
    return (
      `<${P}:conicGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `angle="${trimNumber(paint.angle)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</${P}:conicGradient>`
    );
  }
  if (paint.kind === 'radial-gradient') {
    const stops = stopsXml(paint.stops, paint.interpolate);
    return (
      `<radialGradient id="${id}" gradientUnits="${gradientUnitsAttr(paint.units)}" ` +
      `cx="${trimNumber(paint.center.x)}" cy="${trimNumber(paint.center.y)}" ` +
      `r="${trimNumber(paint.radius)}"` +
      `${interpolateAttr(paint.interpolate)}>${stops}</radialGradient>`
    );
  }
  return '';
}
