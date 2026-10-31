/**
 * An inner or outer stroke, cut to its side of the fill on the CPU, against
 * the same stroke clipped by the stencil. A cut moves an edge's end along it,
 * to a point the rasterizer cannot hold, so a pixel center or sample within
 * its snapping distance of that edge can go the other way: a ribbon
 * triangle's edge, or the fill's own, and for a fill that is not convex, any
 * edge of its triangles. Nothing else may differ.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, polygonFromPoints, type Path, type PolygonPath } from '@weasel-js/geom';
import { tessellate } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from '@weasel-js/stroke';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const W = 96;
const H = 80;

const renderers: WeaselRenderer[] = [];
afterEach(() => {
  for (const r of renderers) r.dispose();
  renderers.length = 0;
});

interface Frame { px: Uint8Array; draws: number }

function paint(commands: DrawCommand[], antialias: boolean, cuts = true): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true, antialias })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderers.push(r);
  if (!cuts) Object.defineProperty(r._batchVariants(), 'cuts', { value: false });
  r.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, draws: r.lastFrameStats().drawCalls };
}

/** Centers of the pixels whose channels differ, in CSS pixels, and the most
 *  any channel differs by. */
function diff(a: Uint8Array, b: Uint8Array): { worst: number; at: [number, number][] } {
  let worst = 0;
  const at: [number, number][] = [];
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k] - b[i + k]));
    if (d === 0) continue;
    worst = Math.max(worst, d);
    const p = i / 4;
    at.push([p % W + 0.5, H - 1 - Math.floor(p / W) + 0.5]);
  }
  return { worst, at };
}

/** Every edge a cut can move, as x0, y0, x1, y1: each edge of the outline
 *  `ring` (x, y pairs, closed) run on as a line, since an outer stroke is cut
 *  into pieces along those lines past the fill, and each triangle of the
 *  ribbon it is cut from. */
function edgesOf(ring: number[], width: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    line(ring[i], ring[i + 1], ring[(i + 2) % ring.length], ring[(i + 3) % ring.length], out);
  }
  return ribbonEdges(polygon(ring), width, out);
}

/** The same for a fill cut to its triangles: each edge of each one run on as a line. */
function triangleEdgesOf(path: Path, width: number): number[] {
  const out: number[] = [];
  const fill = tessellate(path);
  const v = fill.vertices, idx = fill.indices;
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k] * 2, b = idx[t + (k + 1) % 3] * 2;
      line(v[a], v[a + 1], v[b], v[b + 1], out);
    }
  }
  return ribbonEdges(path, width, out);
}

function line(ax: number, ay: number, bx: number, by: number, out: number[]): void {
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
  out.push(ax - ux * 200, ay - uy * 200, bx + ux * 200, by + uy * 200);
}

function ribbonEdges(path: Path, width: number, out: number[]): number[] {
  const ribbon = tessellateStroke(path, { width: width * 2, join: 'miter' });
  const v = ribbon.vertices, idx = ribbon.indices;
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k] * 2, b = idx[t + (k + 1) % 3] * 2;
      out.push(v[a], v[a + 1], v[b], v[b + 1]);
    }
  }
  return out;
}

function fromEdges(edges: number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < edges.length; i += 4) {
    const ax = edges[i], ay = edges[i + 1], dx = edges[i + 2] - ax, dy = edges[i + 3] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

function covered(px: Uint8Array): number {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
}

const ring = (n: number, rx: number, ry: number, turn: number): number[] =>
  Array.from({ length: n }, (_, k) => [48 + rx * Math.cos(turn + (k * 2 * Math.PI) / n), 40 + ry * Math.sin(turn + (k * 2 * Math.PI) / n)]).flat();

const SHAPES: [string, number[]][] = [
  ['a triangle', [12.3, 70.1, 50.2, 8.7, 84.9, 66.4]],
  ['a turned rect', ring(4, 36, 30, 0.3)],
  ['a hexagon', ring(6, 38, 32, 0.1)],
  ['a 48-gon', ring(48, 36, 31, 0)],
];

const polygon = (pts: number[]): Path => polygonFromPoints(Array.from({ length: pts.length / 2 }, (_, k) => ({ x: pts[k * 2], y: pts[k * 2 + 1] })));

function frame(path: Path, align: 'inner' | 'outer', width: number): DrawCommand[] {
  return [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#202020' } } },
    { kind: 'path', path, fill: { paint: { color: '#3366cc' } }, stroke: { width, align, join: 'miter', paint: { color: 'rgba(255, 160, 0, 0.6)' } } },
    { kind: 'path', path: { kind: 'rect', x: 2, y: 2, width: 6, height: 6 }, fill: { paint: { color: '#00ff00' } } },
  ];
}

describe('an aligned stroke on a convex fill, cut on the CPU', () => {
  for (const antialias of [false, true]) {
    for (const [name, pts] of SHAPES) {
      for (const align of ['inner', 'outer'] as const) {
        it(`stays in the run and keeps the stencil's pixels but for edge samples: ${align}, ${name}${antialias ? ', multisampled' : ''}`, () => {
          const cut = paint(frame(polygon(pts), align, 5), antialias);
          const stencil = paint(frame(polygon(pts), align, 5), antialias, false);
          // A cut ribbon past the run's vertex cap draws for itself, but not through the stencil.
          expect(cut.draws).toBeLessThan(stencil.draws);
          if (pts.length < 20) expect(cut.draws).toBe(1);
          expect(covered(cut.px)).toBeGreaterThan(0);
          expect(offEdges(cut, stencil, edgesOf(pts, 5), antialias)).toEqual([]);
          if (antialias) expect(diff(cut.px, stencil.px).worst).toBeLessThanOrEqual(72);
        });
      }
    }
  }

  it('cuts a stroke wider than the fill to what lies inside it', () => {
    const thin = [40.2, 10.1, 56.3, 10.4, 50.1, 70.2];
    const cut = paint(frame(polygon(thin), 'inner', 30), false);
    const stencil = paint(frame(polygon(thin), 'inner', 30), false, false);
    expect(offEdges(cut, stencil, edgesOf(thin, 30), false)).toEqual([]);
  });
});

const NOT_CONVEX: [string, Path][] = [
  ['a notched square', pathFromD('M 10.2 10.1 L 86.3 10.4 L 85.9 70.2 L 48.1 30.3 L 10.4 69.8 Z')],
  ['a star', pathFromD('M 48 6 L 56.2 30.9 L 82.4 31.2 L 61.3 46.8 L 69.1 71.7 L 48 56.4 L 26.9 71.7 L 34.7 46.8 L 13.6 31.2 L 39.8 30.9 Z')],
  ['a square with a hole', pathFromD('M 12.1 8.3 L 84.2 8.6 L 83.8 72.1 L 12.4 71.7 Z M 34.3 28.2 L 34.1 52.4 L 62.2 52.7 L 61.9 28.4 Z')],
];

describe('an aligned stroke on a fill that is not convex, cut to its triangles', () => {
  for (const antialias of [false, true]) {
    for (const [name, path] of NOT_CONVEX) {
      for (const align of ['inner', 'outer'] as const) {
        it(`stays in the run and keeps the stencil's pixels but for edge samples: ${align}, ${name}${antialias ? ', multisampled' : ''}`, () => {
          const cut = paint(frame(path, align, 5), antialias);
          const stencil = paint(frame(path, align, 5), antialias, false);
          expect(cut.draws).toBe(1);
          expect(stencil.draws).toBeGreaterThan(1);
          expect(covered(cut.px)).toBeGreaterThan(0);
          expect(offEdges(cut, stencil, triangleEdgesOf(path, 5), antialias)).toEqual([]);
          if (antialias) expect(diff(cut.px, stencil.px).worst).toBeLessThanOrEqual(72);
        });
      }
    }
  }

  it('keeps the stencil for a fill that draws through the stencil itself', () => {
    const own = stencilledEvenOdd(NOT_CONVEX[0][1] as PolygonPath);
    expect(paint(frame(own, 'inner', 5), false).draws).toBeGreaterThan(1);
  });
});

/** Where `cut` and `stencil` differ farther from every one of `edges` than
 *  the rasterizer may snap: a sixteenth of a pixel single-sampled, as GL ES
 *  allows, and multisampled, as far as a pixel's samples reach. */
function offEdges(cut: Frame, stencil: Frame, edges: number[], antialias: boolean): string[] {
  const near = antialias ? 0.75 : 1 / 16;
  const values = (px: Uint8Array, x: number, y: number) => {
    const i = ((H - 1 - Math.floor(y)) * W + Math.floor(x)) * 4;
    return Array.from(px.slice(i, i + 4)).join(',');
  };
  return diff(cut.px, stencil.px).at.filter(([x, y]) => fromEdges(edges, x, y) > near)
    .map(([x, y]) => `${x},${y} at ${fromEdges(edges, x, y).toFixed(3)}: cut ${values(cut.px, x, y)} stencil ${values(stencil.px, x, y)}`);
}
