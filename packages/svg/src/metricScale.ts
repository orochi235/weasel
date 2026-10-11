/**
 * Uniform scaling of the lengths a node holds in its data instead of its
 * geometry: stroke width and dashes, font size, and letter spacing. A scale
 * applied to coordinates alone (a baked transform, a fit-to-viewport import)
 * leaves these at source size unless they are taken through it too.
 *
 * A `{ px }` length is pinned to the screen and never scaled.
 */
import type { ScreenLength, StyledRun, TextStyle } from '@weasel-js/core';
import { resolveTextStyle } from '@weasel-js/core';

export function scaleLength(v: ScreenLength, scale: number): ScreenLength {
  return typeof v === 'number' ? v * scale : v;
}

interface StrokeMetrics {
  width?: ScreenLength;
  dash?: number[];
}

export function scaleStroke<T extends StrokeMetrics>(stroke: T, scale: number): T {
  // A screen-pinned width takes its dashes with it.
  const { width } = stroke;
  if (scale === 1 || typeof width === 'object') return stroke;
  const out = { ...stroke };
  if (width !== undefined) out.width = width * scale;
  if (out.dash) out.dash = out.dash.map((n) => n * scale);
  return out;
}

export function scaleRuns(runs: readonly StyledRun[], scale: number): StyledRun[] {
  return runs.map((r) => {
    const out = { ...r };
    // `fontScale` and `baselineShift` are relative to the node's size and ride it.
    if (out.fontSize !== undefined) out.fontSize = scaleLength(out.fontSize, scale);
    if (out.letterSpacing !== undefined) out.letterSpacing = scaleLength(out.letterSpacing, scale);
    if (out.stroke) out.stroke = scaleStroke(out.stroke, scale);
    return out;
  });
}

/** `style` with its size stated, since an absent one means the unscaled default. */
export function scaleTextStyle(style: TextStyle | undefined, scale: number): TextStyle {
  const out: TextStyle = { ...style };
  out.fontSize = scaleLength(out.fontSize ?? resolveTextStyle(out).fontSize, scale);
  if (out.letterSpacing !== undefined) out.letterSpacing = scaleLength(out.letterSpacing, scale);
  return out;
}
