import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M } from '../types';

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

function defaultOutHandle(anchors: SharedAnchor[], i: number): { x: number; y: number } {
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

function defaultInHandle(anchors: SharedAnchor[], i: number): { x: number; y: number } {
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

function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}

function cubicEval(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

function cubicDeriv1(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

function cubicDeriv2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 6 * u * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x),
    y: 6 * u * (p2.y - 2 * p1.y + p0.y) + 6 * t * (p3.y - 2 * p2.y + p1.y),
  };
}

export const bezierCubic: CurveRepresentation = {
  kind: 'bezierCubic',
  label: 'Cubic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return cubicEval(a, defaultOutHandle(anchors, segIdx), defaultInHandle(anchors, segIdx), b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const b = anchors[i + 1];
      const c1 = defaultOutHandle(anchors, i);
      const c2 = defaultInHandle(anchors, i);
      cmds.push(PATH_C);
      xs.push(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const p0 = a;
    const p1 = defaultOutHandle(anchors, segIdx);
    const p2 = defaultInHandle(anchors, segIdx);
    const p3 = b;
    const d1 = cubicDeriv1(p0, p1, p2, p3, localT);
    const d2 = cubicDeriv2(p0, p1, p2, p3, localT);
    const num = d1.x * d2.y - d1.y * d2.x;
    const den = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.outHandle || i + 1 < anchors.length) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'out' });
      }
      if (a.inHandle || i > 0) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'in' });
      }
    }
    return out;
  },
};
