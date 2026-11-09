/**
 * Uniform scaling of the lengths a node holds in its data instead of its
 * geometry: stroke width, dashes, and head sizes, font size, and letter spacing. A scale
 * applied to coordinates alone (a baked transform, a fit-to-viewport import)
 * leaves these at source size unless they are taken through it too.
 *
 * A `{ px }` length is pinned to the screen and never scaled.
 */
import type { MarkerRef, ScreenLength, StyledRun, TextStyle } from '@weasel-js/core';
import { resolveTextStyle, scaledDash, scaleVertexWidth, type VertexWidth } from '@weasel-js/core';
import { carryUserScale } from './userScale';

export function scaleLength(v: ScreenLength, scale: number): ScreenLength {
  return typeof v === 'number' ? v * scale : v;
}

interface StrokeMetrics {
  width?: ScreenLength;
  dash?: number[];
  dashOffset?: number;
  vertexWidths?: VertexWidth[];
  markerStart?: MarkerRef;
  markerMid?: MarkerRef;
  markerEnd?: MarkerRef;
}

/** The heads whose size is a world length, scaled; an unsized head follows the width by itself. */
function scaledHeads(stroke: StrokeMetrics, scale: number): Pick<StrokeMetrics, 'markerStart' | 'markerMid' | 'markerEnd'> {
  const out: Pick<StrokeMetrics, 'markerStart' | 'markerMid' | 'markerEnd'> = {};
  for (const role of ['markerStart', 'markerMid', 'markerEnd'] as const) {
    const ref = stroke[role];
    if (typeof ref === 'object' && typeof ref.size === 'number') out[role] = { ...ref, size: ref.size * scale };
  }
  return out;
}

export function scaleStroke<T extends StrokeMetrics>(stroke: T, scale: number): T {
  // A screen-pinned width takes its dashes with it.
  const { width, vertexWidths } = stroke;
  if (scale === 1) return stroke;
  // Per-vertex widths and sized heads are world units on any stroke, a `{ px }` one included.
  const scaledVertices = {
    ...(vertexWidths ? { vertexWidths: vertexWidths.map((n) => scaleVertexWidth(n, scale)) } : {}),
    ...scaledHeads(stroke, scale),
  };
  if (typeof width === 'object') return carryUserScale(stroke, { ...stroke, ...scaledVertices }, scale);
  const out = { ...stroke, ...scaledVertices };
  if (width !== undefined) out.width = width * scale;
  return carryUserScale(stroke, scaledDash(out, scale), scale);
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
