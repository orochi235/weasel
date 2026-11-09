import { countPathAnchors, type PointOrigin, type PolygonPath } from '@weasel-js/geom';
import { parseColor, type VertexWidth } from '@weasel-js/paint';
import { anchorDataPatch } from 'domains/paths/anchorData';
import type { PathNode } from './pathNodes';

/** Channels per anchor in a `vertexColors` array. */
const COLOR_STRIDE = 4;

type Carrier = {
  vertexColors?: number[];
  fill?: unknown;
  stroke?: { width?: unknown; paint?: unknown; vertexWidths?: VertexWidth[]; vertexColors?: number[] } | string | null;
};

const strokeOf = (node: PathNode) => {
  const s = (node.node.data as Carrier | null)?.stroke;
  return s && typeof s === 'object' ? s : undefined;
};

/** A solid paint's color as RGBA, or null for anything else. */
function solidRgba(paint: unknown): number[] | null {
  const p = paint as { kind?: string; color?: unknown } | null | undefined;
  if (!p || (p.kind !== undefined && p.kind !== 'solid') || typeof p.color !== 'string') return null;
  try {
    return [...parseColor(p.color)];
  } catch {
    return null;
  }
}

/**
 * One per-anchor array for the paths joined, each path's own or, where it has none, its anchors filled
 * with `base` of it; null when neither has one, or a path without one has no base to fill from.
 */
function joinedArray<T>(
  sources: readonly { node: PathNode; anchors: number }[],
  own: (node: PathNode) => readonly T[] | undefined,
  base: (node: PathNode) => readonly T[] | null,
  stride: number,
): T[] | null {
  if (!sources.some((s) => own(s.node))) return null;
  const out: T[] = [];
  for (const { node, anchors } of sources) {
    const values = own(node);
    if (values && values.length === anchors * stride) {
      out.push(...values);
      continue;
    }
    const fill = base(node);
    if (!fill) return null;
    for (let i = 0; i < anchors; i++) out.push(...fill);
  }
  return out;
}

/**
 * The per-anchor widths and colors of `keep` and `drop` through their join from `before` (the two paths' subpaths,
 * `keep`'s first) to `after`, with `origins` as `editAnchorSetTracked` answered: each anchor takes its own path's
 * value, a reversed one's sides traded, a merged end the anchor that stays. A path without an array fills its anchors
 * with its own width or solid paint. A patch to lay over `keep`'s data; empty when neither path carries any.
 */
export function joinedAnchorData(
  keep: PathNode,
  drop: PathNode | null,
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): Record<string, unknown> {
  const sources = [keep, ...(drop ? [drop] : [])].map((node) => ({ node, anchors: countPathAnchors(node.path) }));
  const data = (keep.node.data ?? {}) as Carrier;
  const stroke = strokeOf(keep);
  const widths = joinedArray<VertexWidth>(
    sources, (n) => strokeOf(n)?.vertexWidths,
    (n) => { const w = strokeOf(n)?.width; return [typeof w === 'number' ? w : Number.NaN]; }, 1,
  );
  const strokeColors = joinedArray<number>(sources, (n) => strokeOf(n)?.vertexColors, (n) => solidRgba(strokeOf(n)?.paint), COLOR_STRIDE);
  const fillColors = joinedArray<number>(
    sources, (n) => (n.node.data as Carrier | null)?.vertexColors,
    (n) => solidRgba((n.node.data as Carrier | null)?.fill), COLOR_STRIDE,
  );
  const combined: Carrier = { ...(fillColors ? { vertexColors: fillColors } : {}) };
  if (stroke && (widths || strokeColors)) {
    combined.stroke = { ...stroke, ...(widths ? { vertexWidths: widths } : {}), ...(strokeColors ? { vertexColors: strokeColors } : {}) };
  }
  if (!combined.vertexColors && !combined.stroke) return {};
  const { skin: _skinIsGeometryBound, ...patch } = anchorDataPatch({ ...data, ...combined, skin: undefined }, before, after, origins);
  return patch;
}
