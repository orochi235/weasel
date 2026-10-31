/**
 * An inner or outer stroke on a convex fill, cut to its side on the CPU,
 * against the same stroke clipped by the stencil. A cut moves an edge's end
 * along it, to a point the rasterizer cannot hold, so a pixel center or sample
 * within its snapping distance of that edge can go the other way: a ribbon
 * triangle's edge, or the fill's own. Nothing else may differ.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, polygonFromPoints, type Path } from '@weasel-js/geom';
import { tessellateStroke } from '@weasel-js/stroke';
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
    const ax = ring[i], ay = ring[i + 1], bx = ring[(i + 2) % ring.length], by = ring[(i + 3) % ring.length];
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    out.push(ax - ux * 200, ay - uy * 200, bx + ux * 200, by + uy * 200);
  }
  const ribbon = tessellateStroke(polygon(ring), { width: width * 2, join: 'miter' });
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
          const d = diff(cut.px, stencil.px);
          // Single-sampled, the pixel center lies within the snapping GL ES
          // allows (a sixteenth of a pixel) of an edge; multisampled, one of its samples does.
          const near = antialias ? 0.75 : 1 / 16;
          const edges = edgesOf(pts, 5);
          const off = d.at.filter(([x, y]) => fromEdges(edges, x, y) > near);
          const values = (px: Uint8Array, x: number, y: number) => {
            const i = ((H - 1 - Math.floor(y)) * W + Math.floor(x)) * 4;
            return Array.from(px.slice(i, i + 4)).join(',');
          };
          expect(off.map(([x, y]) => `${x},${y} at ${fromEdges(edges, x, y).toFixed(3)}: cut ${values(cut.px, x, y)} stencil ${values(stencil.px, x, y)}`)).toEqual([]);
          if (antialias) expect(d.worst).toBeLessThanOrEqual(72);
        });
      }
    }
  }

  it('keeps the stencil for a fill that is not convex', () => {
    const notch = pathFromD('M 10 10 L 86 10 L 86 70 L 48 30 L 10 70 Z');
    expect(paint(frame(notch, 'inner', 5), false).draws).toBeGreaterThan(1);
  });

  it('cuts a stroke wider than the fill to what lies inside it', () => {
    const thin = [40.2, 10.1, 56.3, 10.4, 50.1, 70.2];
    const cut = paint(frame(polygon(thin), 'inner', 30), false);
    const stencil = paint(frame(polygon(thin), 'inner', 30), false, false);
    const edges = edgesOf(thin, 30);
    expect(diff(cut.px, stencil.px).at.filter(([x, y]) => fromEdges(edges, x, y) > 1 / 16)).toEqual([]);
  });
});
