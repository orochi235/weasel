import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M } from '../types';

/** Default handle distance when an anchor has no explicit in/out handle.
 *  1/3 of the inter-anchor distance is a sensible smooth-curve default. */
const DEFAULT_HANDLE_FRACTION = 1 / 3;

function defaultOutHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (a.outHandle) return a.outHandle;
  return {
    x: a.x + (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: a.y + (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
  };
}

function defaultInHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (b.inHandle) return b.inHandle;
  return {
    x: b.x - (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: b.y - (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
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
    return cubicEval(a, defaultOutHandle(a, b), defaultInHandle(a, b), b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const c1 = defaultOutHandle(a, b);
      const c2 = defaultInHandle(a, b);
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
    const p1 = defaultOutHandle(a, b);
    const p2 = defaultInHandle(a, b);
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
