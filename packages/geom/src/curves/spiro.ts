// v1 Spiro: interpolating cubic spline with tangents computed from
// neighbor positions for smooth anchors and pinned to incoming/outgoing
// edges for corner anchors. This is NOT the full Raph Levien κ-curve
// solver — that's a global numerical iteration. v1.1 swaps the real
// Spiro in behind this same module surface.
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M } from '../commands';
import { segmentAt } from './anchorHandles';
import { cubicPointAt } from '../paths/cubicMath';
import { cubicCurvatureAt } from '../paths/curvature';

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

/** Spiro (κ-curves): curvature-continuous through each anchor, so joins stay visually smooth without hand-tuned handles. Approximated as cubics when converted to a path. */
export const spiro: CurveRepresentation = {
  kind: 'spiro',
  label: 'Spiro (κ-curves v1)',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const { c1, c2 } = controlsFor(anchors, segIdx);
    return cubicPointAt(a, c1, c2, b, localT);
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
    return cubicCurvatureAt(a, c1, c2, b, localT);
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
