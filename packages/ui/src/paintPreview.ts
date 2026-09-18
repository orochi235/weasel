// A `FillStyle` as one CSS background string, for the swatches and chips that
// stand in for a paint in a panel.
//
// The gradient kinds are sampled rather than translated stop for stop: CSS
// blends its own stops in sRGB, so an OKLCh gradient handed over as two stops
// would preview as the sRGB blend of its ends. Sampling through
// `sampleGradientStops` in the paint's own space puts the curve into the
// stops themselves, and the browser only interpolates the short hops between.

import { sampleGradientStops, type FillStyle } from '@weasel-js/core';

/** Sample count along a previewed gradient. Enough that a hue arc reads as a
 *  curve at chip size; a straight sRGB ramp would need a fraction of it. */
const SAMPLES = 24;

/**
 * A mesh patch as four corner radials over a flat base.
 *
 * This is an approximation and cannot be anything else — CSS has no mesh, and
 * the real surface only exists once the renderer has baked it. Each corner
 * fades out across the chip and they composite to something bilinear-ish,
 * which is enough for a swatch to say "this one, not that one". Zero alpha is
 * written as `color-mix` with `transparent` so a named or packed-alpha color
 * works without being parsed here.
 */
function meshPreview(paint: { patches?: { colors: string[] }[] }): string | undefined {
  const colors = paint.patches?.[0]?.colors;
  if (!colors || colors.length < 4) return undefined;
  const fade = (c: string): string => `color-mix(in srgb, ${c} 0%, transparent)`;
  const at: [string, string][] = [
    ['0% 0%', colors[0]], ['100% 0%', colors[1]],
    ['100% 100%', colors[2]], ['0% 100%', colors[3]],
  ];
  const layers = at.map(([pos, c]) =>
    `radial-gradient(farthest-corner at ${pos}, ${c}, ${fade(c)})`);
  // The base keeps the middle opaque where the four fades have all thinned.
  layers.push(`linear-gradient(to bottom, ${colors[0]}, ${colors[2]})`);
  return layers.join(', ');
}

/** CSS color stops across the whole ramp, in the gradient's own blend space. */
function sampledStops(paint: Extract<FillStyle, { stops: unknown }>): string {
  const space = paint.interpolate ?? 'rgb';
  const out: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    out.push(`${sampleGradientStops(paint.stops, t, space)} ${(t * 100).toFixed(1)}%`);
  }
  return out.join(', ');
}

const DEG = 180 / Math.PI;

/** A fraction of the box as a CSS percentage. A gradient in absolute units has
 *  no box to be a fraction of, so its geometry only ever approximates here. */
function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * `paint` as a CSS `background` value, or `undefined` for a paint with no CSS
 * form — a pattern, a registered kind — which a caller shows as a checker or
 * a placeholder rather than as an invented color.
 *
 * Gradient geometry is honored as far as CSS can carry it: the angle of a
 * linear gradient, the center of a radial or conic one. A paint in `'world'`
 * or `'local'` units is measured in the scene rather than in the chip, so its
 * preview shows the ramp and not the placement.
 */
export function paintPreviewCss(paint: FillStyle | null | undefined): string | undefined {
  if (paint == null) return undefined;
  const kind = paint.fill ?? 'solid';
  if (kind === 'solid') return (paint as { color: string }).color;

  if (paint.fill === 'linear-gradient') {
    const dx = paint.to.x - paint.from.x;
    const dy = paint.to.y - paint.from.y;
    // CSS measures from "to top", clockwise; the paint measures in a
    // y-down plane from +x.
    const angle = dx === 0 && dy === 0 ? 90 : Math.atan2(dx, -dy) * DEG;
    return `linear-gradient(${angle.toFixed(1)}deg, ${sampledStops(paint)})`;
  }
  if (paint.fill === 'radial-gradient') {
    const at = `at ${pct(paint.center.x)} ${pct(paint.center.y)}`;
    return `radial-gradient(circle ${at}, ${sampledStops(paint)})`;
  }
  if ((paint.fill as string) === 'mesh-gradient') {
    return meshPreview(paint as unknown as { patches?: { colors: string[] }[] });
  }
  if (paint.fill === 'conic-gradient') {
    // CSS starts a conic gradient at "to top"; the paint starts at +x.
    const from = (paint.angle * DEG + 90).toFixed(1);
    return `conic-gradient(from ${from}deg at ${pct(paint.center.x)} ${pct(paint.center.y)}, ${sampledStops(paint)})`;
  }
  return undefined;
}
