// v1 Spiro: interpolating cubic spline with tangents computed from
// neighbor positions for smooth anchors and pinned to incoming/outgoing
// edges for corner anchors. This is NOT the full Raph Levien κ-curve
// solver — that's a global numerical iteration. v1.1 swaps the real
// Spiro in behind this same module surface.
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M, type PolygonPath } from '../types';

const TANGENT_SCALE = 1 / 3;

function isCorner(a: SharedAnchor): boolean {
  return a.spiroType === 'corner';
}

function smoothTangent(anchors: SharedAnchor[], i: number): { x: number; y: number } | null {
  if (isCorner(anchors[i])) return null;
  const prev = i > 0 ? anchors[i - 1] : null;
  const next = i + 1 < anchors.length ? anchors[i + 1] : null;
  if (!prev && !next) return null;
  if (!prev) {
    return { x: next!.x - anchors[i].x, y: next!.y - anchors[i].y };
  }
  if (!next) {
    return { x: anchors[i].x - prev.x, y: anchors[i].y - prev.y };
  }
  const inDX = anchors[i].x - prev.x;
  const inDY = anchors[i].y - prev.y;
  const outDX = next.x - anchors[i].x;
  const outDY = next.y - anchors[i].y;
  const inLen = Math.hypot(inDX, inDY) || 1;
  const outLen = Math.hypot(outDX, outDY) || 1;
  return {
    x: inDX / inLen + outDX / outLen,
    y: inDY / inLen + outDY / outLen,
  };
}

function controlsFor(
  anchors: SharedAnchor[],
  i: number,
): { c1: { x: number; y: number }; c2: { x: number; y: number } } {
  const a = anchors[i];
  const b = anchors[i + 1];
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const edgeLen = Math.hypot(edge.x, edge.y) || 1;

  const tA = smoothTangent(anchors, i);
  const tB = smoothTangent(anchors, i + 1);

  const outA = tA ?? edge;
  const outB = tB ?? edge;

  const outALen = Math.hypot(outA.x, outA.y) || 1;
  const outBLen = Math.hypot(outB.x, outB.y) || 1;
  const handleLen = edgeLen * TANGENT_SCALE;
  return {
    c1: {
      x: a.x + (outA.x / outALen) * handleLen,
      y: a.y + (outA.y / outALen) * handleLen,
    },
    c2: {
      x: b.x - (outB.x / outBLen) * handleLen,
      y: b.y - (outB.y / outBLen) * handleLen,
    },
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

export const spiro: CurveRepresentation = {
  kind: 'spiro',
  label: 'Spiro (κ-curves v1)',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const { c1, c2 } = controlsFor(anchors, segIdx);
    return cubicEval(a, c1, c2, b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const b = anchors[i + 1];
      const { c1, c2 } = controlsFor(anchors, i);
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
    const { c1, c2 } = controlsFor(anchors, segIdx);
    const u = 1 - localT;
    const d1x = 3 * u * u * (c1.x - a.x) + 6 * u * localT * (c2.x - c1.x) + 3 * localT * localT * (b.x - c2.x);
    const d1y = 3 * u * u * (c1.y - a.y) + 6 * u * localT * (c2.y - c1.y) + 3 * localT * localT * (b.y - c2.y);
    const d2x = 6 * u * (c2.x - 2 * c1.x + a.x) + 6 * localT * (b.x - 2 * c2.x + c1.x);
    const d2y = 6 * u * (c2.y - 2 * c1.y + a.y) + 6 * localT * (b.y - 2 * c2.y + c1.y);
    const num = d1x * d2y - d1y * d2x;
    const den = Math.pow(d1x * d1x + d1y * d1y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      out.push({
        kind: 'enum',
        label: `t${i}`,
        anchorIndex: i,
        field: 'spiroType',
        options: ['g2-smooth', 'g4-smooth', 'corner'] as const,
        value: anchors[i].spiroType ?? 'g2-smooth',
      });
    }
    return out;
  },
};
