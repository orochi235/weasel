import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_M, PATH_Q } from '../types';

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

function quadControl(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  const c1 = defaultOutHandle(a, b);
  const c2 = defaultInHandle(a, b);
  return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
}

function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}

function quadEval(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function quadDeriv1(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function quadDeriv2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: 2 * (p2.x - 2 * p1.x + p0.x),
    y: 2 * (p2.y - 2 * p1.y + p0.y),
  };
}

export const bezierQuadratic: CurveRepresentation = {
  kind: 'bezierQuadratic',
  label: 'Quadratic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return quadEval(a, quadControl(a, b), b, localT);
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
      const q = quadControl(a, b);
      cmds.push(PATH_Q);
      xs.push(q.x, q.y, b.x, b.y);
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
    const p1 = quadControl(a, b);
    const d1 = quadDeriv1(a, p1, b, localT);
    const d2 = quadDeriv2(a, p1, b);
    const num = d1.x * d2.y - d1.y * d2.x;
    const den = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(_anchors): Discriminator[] {
    // Quadratic has no user-facing controls — each segment's quadratic
    // control is fully determined by the cubic handles via midpoint.
    return [];
  },
};
