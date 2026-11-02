import type { DrawCommand } from '@weasel-js/core/renderer';
import type { RenderLayer, View } from '@weasel-js/core';
import { combTeeth, polylineFromPoints, viewWorldToScreen } from '@weasel-js/geom';
import { curvatureSourceOf, type CurveRepresentation, type SharedAnchor } from '@weasel-js/geom/curves';

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
        const { x: sx, y: sy } = viewWorldToScreen(view, a);
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: sx - 4, y: sy - 4, width: 8, height: 8 },
          fill: { paint: { color: '#ffffff' } },
          stroke: { paint: { color: '#3478f6' }, width: 1 },
        } as DrawCommand);
        if (rep.kind === 'bezierCubic') {
          if (a.outHandle) {
            const { x: hx, y: hy } = viewWorldToScreen(view, a.outHandle);
            out.push({
              kind: 'path',
              path: linePath(sx, sy, hx, hy),
              stroke: { paint: { color: '#7da7e8' }, width: 1 },
            } as DrawCommand);
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, 4),
              fill: { paint: { color: 'rgba(125, 167, 232, 0.5)' } },
            } as DrawCommand);
          }
          if (a.inHandle) {
            const { x: hx, y: hy } = viewWorldToScreen(view, a.inHandle);
            out.push({
              kind: 'path',
              path: linePath(sx, sy, hx, hy),
              stroke: { paint: { color: '#7da7e8' }, width: 1 },
            } as DrawCommand);
            out.push({
              kind: 'path',
              path: circlePath(hx, hy, 4),
              fill: { paint: { color: 'rgba(125, 167, 232, 0.5)' } },
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
  const paint = { color: 'rgba(255, 120, 80, 0.6)' };
  return {
    id: `curve-lab-comb-${rep.kind}`,
    label: 'Curvature comb',
    space: 'screen',
    draw: (_data, view: View) => {
      const anchors = getAnchors();
      if (anchors.length < 2) return [];
      const teeth = combTeeth(curvatureSourceOf(rep, anchors), { scale, samplesPerSegment: 65 });
      const out: DrawCommand[] = teeth.map((tooth) => {
        const { x: sx, y: sy } = viewWorldToScreen(view, tooth);
        const { x: ex, y: ey } = viewWorldToScreen(view, { x: tooth.tipX, y: tooth.tipY });
        return { kind: 'path', path: linePath(sx, sy, ex, ey), stroke: { paint, width: 1 } } as DrawCommand;
      });
      const tips = teeth.map((tooth) => viewWorldToScreen(view, { x: tooth.tipX, y: tooth.tipY }));
      out.push({ kind: 'path', path: polylineFromPoints(tips), stroke: { paint, width: 1.5 } } as DrawCommand);
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
          const { x: sx, y: sy } = viewWorldToScreen(view, p);
          out.push({
            kind: 'path',
            path: circlePath(sx, sy, 5),
            stroke: { paint: { color: '#ffaa00' }, width: 1.5 },
          } as DrawCommand);
        }
        if (i > 1 && Math.abs(ks[i - 1]) > Math.abs(ks[i]) && Math.abs(ks[i - 1]) > Math.abs(ks[i - 2])) {
          const p = pts[i - 1];
          const { x: sx, y: sy } = viewWorldToScreen(view, p);
          out.push({
            kind: 'path',
            path: { kind: 'rect', x: sx - 3, y: sy - 3, width: 6, height: 6 },
            fill: { paint: { color: '#ffaa00' } },
          } as DrawCommand);
        }
      }
      return out;
    },
  };
}
