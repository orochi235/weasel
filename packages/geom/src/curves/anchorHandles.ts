import type { SharedAnchor } from './types';

const DEFAULT_HANDLE_FRACTION = 1 / 3;

/** Smooth tangent at anchor i derived from neighbor edges. Average the
 *  incoming and outgoing edge directions weighted by inverse edge length
 *  (centripetal-style) so short edges don't dominate. At endpoints the
 *  single available edge wins. Without this, a handle colinear with one
 *  segment produces a degenerate (visually straight) cubic. */
function smoothTangent(anchors: SharedAnchor[], i: number): { x: number; y: number } {
  const prev = i > 0 ? anchors[i - 1] : null;
  const next = i + 1 < anchors.length ? anchors[i + 1] : null;
  if (!prev && next) return { x: next.x - anchors[i].x, y: next.y - anchors[i].y };
  if (prev && !next) return { x: anchors[i].x - prev.x, y: anchors[i].y - prev.y };
  if (prev && next) {
    const inLen = Math.hypot(anchors[i].x - prev.x, anchors[i].y - prev.y) || 1;
    const outLen = Math.hypot(next.x - anchors[i].x, next.y - anchors[i].y) || 1;
    return {
      x: (anchors[i].x - prev.x) / inLen + (next.x - anchors[i].x) / outLen,
      y: (anchors[i].y - prev.y) / inLen + (next.y - anchors[i].y) / outLen,
    };
  }
  return { x: 0, y: 0 };
}

export function defaultOutHandle(anchors: SharedAnchor[], i: number): { x: number; y: number } {
  const a = anchors[i];
  if (a.outHandle) return a.outHandle;
  const next = anchors[i + 1];
  const edgeLen = Math.hypot(next.x - a.x, next.y - a.y);
  const t = smoothTangent(anchors, i);
  const tLen = Math.hypot(t.x, t.y) || 1;
  return {
    x: a.x + (t.x / tLen) * edgeLen * DEFAULT_HANDLE_FRACTION,
    y: a.y + (t.y / tLen) * edgeLen * DEFAULT_HANDLE_FRACTION,
  };
}

export function defaultInHandle(anchors: SharedAnchor[], i: number): { x: number; y: number } {
  const b = anchors[i + 1];
  if (b.inHandle) return b.inHandle;
  const a = anchors[i];
  const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
  const t = smoothTangent(anchors, i + 1);
  const tLen = Math.hypot(t.x, t.y) || 1;
  return {
    x: b.x - (t.x / tLen) * edgeLen * DEFAULT_HANDLE_FRACTION,
    y: b.y - (t.y / tLen) * edgeLen * DEFAULT_HANDLE_FRACTION,
  };
}

export function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}
