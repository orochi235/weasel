import type { DrawCommand } from '../../../../src/renderer';
import type { RenderLayer } from '../../../../src/core/layers/render';
import type { View } from '../../../../src/core/viewport/view';
import type { CurveRepresentation, SharedAnchor } from '../../../../src/features/paths/curves';

interface ViewLike { x: number; y: number; scale: { x: number; y: number } }

function w2s(wx: number, wy: number, view: ViewLike): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

function circlePath(cx: number, cy: number, r: number) {
  const k = 0.5522847498;
  return {
    kind: 'polygon' as const,
    commands: new Uint8Array([0, 2, 2, 2, 2]),
    coords: new Float32Array([
      cx + r, cy,
      cx + r, cy + k * r,  cx + k * r, cy + r,  cx, cy + r,
      cx - k * r, cy + r,  cx - r, cy + k * r,  cx - r, cy,
      cx - r, cy - k * r,  cx - k * r, cy - r,  cx, cy - r,
      cx + k * r, cy - r,  cx + r, cy - k * r,  cx + r, cy,
    ]),
    fillRule: 'nonzero' as const,
  };
}

function linePath(ax: number, ay: number, bx: number, by: number) {
  return {
    kind: 'polygon' as const,
    commands: new Uint8Array([0, 1]),
    coords: new Float32Array([ax, ay, bx, by]),
    fillRule: 'nonzero' as const,
  };
}

export function createAnchorsLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
): RenderLayer<unknown> {
  return {
    id: `curve-lab-anchors-${rep.kind}`,
    label: 'Anchors',
    space: 'screen',
    draw: (_data, view: View) => {
      const anchors = getAnchors();
      const out: DrawCommand[] = [];
      for (const a of anchors) {
        const [sx, sy] = w2s(a.x, a.y, view);
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: sx - 4, y: sy - 4, width: 8, height: 8 },
          fill: { color: '#ffffff' },
          stroke: { paint: { color: '#3478f6' }, width: 1 },
        } as DrawCommand);
        if (rep.kind === 'bezierCubic') {
          if (a.outHandle) {
            const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
            out.push({
              kind: 'path',
              path: linePath(sx, sy, hx, hy),
              stroke: { paint: { color: '#7da7e8' }, width: 1 },
            } as DrawCommand);
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, 4),
              fill: { color: 'rgba(125, 167, 232, 0.5)' },
            } as DrawCommand);
          }
          if (a.inHandle) {
            const [hx, hy] = w2s(a.inHandle.x, a.inHandle.y, view);
            out.push({
              kind: 'path',
              path: linePath(sx, sy, hx, hy),
              stroke: { paint: { color: '#7da7e8' }, width: 1 },
            } as DrawCommand);
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, 4),
              fill: { color: 'rgba(125, 167, 232, 0.5)' },
            } as DrawCommand);
          }
        }
      }
      return out;
    },
  };
}

export function createCurvatureCombLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
  scale = 600,
): RenderLayer<unknown> {
  const SAMPLES = 64;
  return {
    id: `curve-lab-comb-${rep.kind}`,
    label: 'Curvature comb',
    space: 'screen',
    draw: (_data, view: View) => {
      const anchors = getAnchors();
      if (anchors.length < 2) return [];
      const out: DrawCommand[] = [];
      const eps = 1 / SAMPLES;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const p = rep.evaluate(anchors, t);
        const t0 = Math.max(0, t - eps);
        const t1 = Math.min(1, t + eps);
        const p0 = rep.evaluate(anchors, t0);
        const p1 = rep.evaluate(anchors, t1);
        const tx = p1.x - p0.x;
        const ty = p1.y - p0.y;
        const tLen = Math.hypot(tx, ty) || 1;
        const nx = -ty / tLen;
        const ny = tx / tLen;
        const k = rep.curvatureAt(anchors, t);
        const len = k * scale;
        const [sx, sy] = w2s(p.x, p.y, view);
        const [ex, ey] = w2s(p.x + nx * len, p.y + ny * len, view);
        out.push({
          kind: 'path',
          path: linePath(sx, sy, ex, ey),
          stroke: { paint: { color: 'rgba(255, 120, 80, 0.6)' }, width: 1 },
        } as DrawCommand);
      }
      return out;
    },
  };
}

export function createInflectionsLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
): RenderLayer<unknown> {
  const SAMPLES = 128;
  return {
    id: `curve-lab-inflections-${rep.kind}`,
    label: 'Inflections + extrema',
    space: 'screen',
    draw: (_data, view: View) => {
      const anchors = getAnchors();
      if (anchors.length < 2) return [];
      const ks: number[] = [];
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        ks.push(rep.curvatureAt(anchors, t));
        pts.push(rep.evaluate(anchors, t));
      }
      const out: DrawCommand[] = [];
      for (let i = 1; i < ks.length; i++) {
        if (ks[i - 1] === 0) continue;
        if (Math.sign(ks[i]) !== Math.sign(ks[i - 1]) && ks[i] !== 0) {
          const p = pts[i];
          const [sx, sy] = w2s(p.x, p.y, view);
          out.push({
            kind: 'path',
            path: circlePath(sx, sy, 5),
            stroke: { paint: { color: '#ffaa00' }, width: 1.5 },
          } as DrawCommand);
        }
        if (i > 1 && Math.abs(ks[i - 1]) > Math.abs(ks[i]) && Math.abs(ks[i - 1]) > Math.abs(ks[i - 2])) {
          const p = pts[i - 1];
          const [sx, sy] = w2s(p.x, p.y, view);
          out.push({
            kind: 'path',
            path: { kind: 'rect', x: sx - 3, y: sy - 3, width: 6, height: 6 },
            fill: { color: '#ffaa00' },
          } as DrawCommand);
        }
      }
      return out;
    },
  };
}
