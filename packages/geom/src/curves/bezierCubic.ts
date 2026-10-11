import type { CurveRepresentation, Discriminator } from './types';
import { defaultInHandle, defaultOutHandle, segmentAt } from './anchorHandles';
import { PATH_C, PATH_M } from '../commands';
import { cubicPointAt } from '../paths/cubicMath';

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

/** Cubic bezier: each segment takes two control handles. The familiar pen-tool curve, and what SVG path data stores natively. */
export const bezierCubic: CurveRepresentation = {
  kind: 'bezierCubic',
  label: 'Cubic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return cubicPointAt(a, defaultOutHandle(anchors, segIdx), defaultInHandle(anchors, segIdx), b, localT);
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
