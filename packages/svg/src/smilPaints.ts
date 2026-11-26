/**
 * A leaf's or a group's paint attributes as fields of its data, for `sceneDataTarget`: `fill` and
 * `stroke` as RGBA in 0..1, `stroke-width`, `stroke-dasharray` and `stroke-dashoffset` as the
 * document writes them, scaled into the node by the factor its import scaled them by.
 */
import { rgbaToHex, tryParseColor } from '@weasel-js/paint';
import type { DataLens, Paint, Stroke } from '@weasel-js/core';

type Data = Record<string, unknown>;
type Rgba = [number, number, number, number];

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const paintOf = (data: Data, field: 'fill' | 'stroke'): Paint | undefined => {
  const holder = data[field];
  return typeof holder === 'object' && holder !== null ? (holder as { paint?: Paint }).paint : undefined;
};

/** `fill` or `stroke` as a color: what the paint's color reads as, and a solid of the color given, keeping the paint's opacity. */
function colorLens(field: 'fill' | 'stroke'): DataLens<Data, Rgba> {
  return {
    key: `svg:${field}`,
    get(data) {
      const p = paintOf(data, field);
      const rgba = p && 'color' in p && typeof p.color === 'string' ? tryParseColor(p.color) : null;
      return rgba ? [...rgba] as Rgba : [0, 0, 0, 1];
    },
    with(data, [r, g, b, a]) {
      const holder = data[field];
      if (typeof holder !== 'object' || holder === null) return data;
      const was = paintOf(data, field);
      const paint: Paint = { kind: 'solid', color: rgbaToHex([clamp01(r), clamp01(g), clamp01(b), clamp01(a)]), ...(was?.opacity !== undefined ? { opacity: was.opacity } : {}) };
      return { ...data, [field]: { ...holder, paint } };
    },
  };
}

/** A number of the stroke's, written times `scale`. */
function strokeNumberLens(key: string, field: 'width' | 'dashOffset', scale: number): DataLens<Data, number> {
  return {
    key,
    get: (data) => (((data.stroke as Stroke | undefined)?.[field] as number | undefined) ?? 0) / scale,
    with: (data, v) => (typeof data.stroke === 'object' && data.stroke ? { ...data, stroke: { ...(data.stroke as Stroke), [field]: v * scale } } : data),
  };
}

function dashLens(scale: number): DataLens<Data, number[]> {
  return {
    key: 'svg:stroke-dasharray',
    get: (data) => ((data.stroke as Stroke | undefined)?.dash ?? []).map((d) => d / scale),
    with: (data, v) => (typeof data.stroke === 'object' && data.stroke ? { ...data, stroke: { ...(data.stroke as Stroke), dash: v.map((d) => d * scale) } } : data),
  };
}

/** The lens for paint attribute `attribute`, its lengths scaled by `scale`; undefined for one that is not a paint attribute. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paintLensFor(attribute: string, scale: number): DataLens<Data, any> | undefined {
  switch (attribute) {
    case 'fill': case 'stroke': return colorLens(attribute);
    case 'stroke-width': return strokeNumberLens('svg:stroke-width', 'width', scale);
    case 'stroke-dashoffset': return strokeNumberLens('svg:stroke-dashoffset', 'dashOffset', scale);
    case 'stroke-dasharray': return dashLens(scale);
    default: return undefined;
  }
}
