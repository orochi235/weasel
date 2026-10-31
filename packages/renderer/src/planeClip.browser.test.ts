/**
 * A convex clip cut on the CPU, on a multisampled buffer where the batch
 * shader decides no hulls, against the same clip on the stencil. A cut point
 * on a slanted edge is not one the rasterizer can hold, so a sample lying that
 * close to the clip's edge can go the other way (`batchClip.ts`), and along an
 * edge that runs through the sample grid, as a 45-degree one does, many do.
 * The cut is held to one sample a pixel, on the clip's edges and the edges of
 * what it cuts only: never a seam inside either.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, polygonFromPoints, type Path, type PolygonPath } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { stencilledEvenOdd } from './testing/stencilledEvenOdd';

const W = 96;
const H = 80;

const renderers: WeaselRenderer[] = [];
afterEach(() => {
  for (const r of renderers) r.dispose();
  renderers.length = 0;
});

interface Frame { px: Uint8Array; draws: number }

/** Render `commands` on a multisampled buffer. `cuts: false` takes the CPU
 *  cut away, so every convex clip goes on the stencil. */
function paint(commands: DrawCommand[], cuts = true): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true, antialias: true })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderers.push(r);
  if (!cuts) Object.defineProperty(r._batchVariants(), 'cuts', { value: false });
  r.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, draws: r.lastFrameStats().drawCalls };
}

/** Pixels whose channels differ, with the most any channel differs by, and
 *  each pixel's center as `[x, y]` in CSS pixels. */
interface Diff { worst: number; at: [number, number][] }

function diff(a: Uint8Array, b: Uint8Array): Diff {
  const out: Diff = { worst: 0, at: [] };
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k] - b[i + k]));
    if (d === 0) continue;
    out.worst = Math.max(out.worst, d);
    const p = i / 4;
    out.at.push([p % W + 0.5, H - 1 - Math.floor(p / W) + 0.5]);
  }
  return out;
}

/** How far `(x, y)` lies from the nearest edge of any of `clips`. */
function fromEdge(clips: Path[], x: number, y: number): number {
  let best = Infinity;
  for (const clip of clips) {
    const c = clip.kind === 'rect'
      ? [clip.x, clip.y, clip.x + clip.width, clip.y, clip.x + clip.width, clip.y + clip.height, clip.x, clip.y + clip.height]
      : Array.from(clip.coords);
    for (let i = 0; i < c.length; i += 2) {
      const ax = c[i], ay = c[i + 1], bx = c[(i + 2) % c.length], by = c[(i + 3) % c.length];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    }
  }
  return best;
}

/** Fail on a pixel off the edges of `paths`, or one more than a sample off. */
function expectEdgeSamplesOnly(d: Diff, clips: Path[]): void {
  const inside = d.at.filter(([x, y]) => fromEdge(clips, x, y) > 1);
  expect(inside.map(([x, y]) => `${x},${y}`)).toEqual([]);
  expect(d.worst).toBeLessThanOrEqual(ONE_SAMPLE);
}

function covered(px: Uint8Array): number {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
}

function turned(cx: number, cy: number, w: number, h: number, deg: number): Path {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const corner = (x: number, y: number) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  return polygonFromPoints([corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)]);
}

const FULL = { kind: 'rect' as const, x: 0, y: 0, width: W, height: H };
const solid = (color: string, path: Path = FULL): DrawCommand =>
  ({ kind: 'path', path, fill: { paint: { color } } });

/** The same fill drawing for itself, so its clip goes on the stencil. */
function ownDraw(color: string, path: Path = FULL): DrawCommand {
  const polygon = path.kind === 'rect'
    ? polygonFromPoints([
      { x: path.x, y: path.y }, { x: path.x + path.width, y: path.y },
      { x: path.x + path.width, y: path.y + path.height }, { x: path.x, y: path.y + path.height },
    ])
    : path;
  return { kind: 'path', path: stencilledEvenOdd(polygon as PolygonPath), fill: { paint: { color } } };
}

const clipped = (clip: Path, children: DrawCommand[]): DrawCommand => ({ kind: 'group', clip, children });

/** An octagon, a mesh whose inner edges cross any clip through it. */
const OCTAGON = pathFromD(`M ${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
  const a = (k * Math.PI) / 4 + 0.2;
  return `${48 + 40 * Math.cos(a)} ${40 + 34 * Math.sin(a)}`;
}).join(' L ')} Z`);

const CLIPS: [string, Path][] = [
  ...[3, 17, 30, 45, 62, 81].map((deg) => [`a rect turned ${deg} degrees`, turned(48.3, 39.7, 61.2, 37.9, deg)] as [string, Path]),
  ['a diamond whose edges cross pixel centers', pathFromD('M 48.5 8.5 L 80.5 40.5 L 48.5 72.5 L 16.5 40.5 Z')],
  ['a convex pentagon', pathFromD('M 50 5 L 90 30 L 75 75 L 20 70 L 8 28 Z')],
  ['a sliver a pixel wide', pathFromD('M 10 10 L 86 60 L 85.2 61.1 L 9.3 11.2 Z')],
];

/** The most a channel moves when one of a pixel's four samples flips, with
 *  room for rounding. */
const ONE_SAMPLE = 72;

describe('a convex clip cut on the CPU, on a multisampled buffer', () => {
  for (const [name, clip] of CLIPS) {
    it(`stays in the run and keeps the stencil's pixels but for a few edge samples: ${name}`, () => {
      const frame = (draw: typeof solid) => [solid('#202020'), clipped(clip, [draw('#ff0000')])];
      const cut = paint(frame(solid));
      const stencil = paint(frame(ownDraw));
      expect(cut.draws).toBe(1);
      expect(stencil.draws).toBeGreaterThan(1);
      expect(covered(cut.px)).toBeGreaterThan(0);
      expectEdgeSamplesOnly(diff(cut.px, stencil.px), [clip]);
    });

    it(`cuts a translucent mesh across it with no seam inside: ${name}`, () => {
      const frame = (draw: typeof solid) => [solid('#202020'), clipped(clip, [draw('#00ff0080', OCTAGON)])];
      const cut = paint(frame(solid));
      const stencil = paint(frame(solid), false);
      expect(cut.draws).toBe(1);
      // The octagon's own edges are cut too, where they cross the clip.
      expectEdgeSamplesOnly(diff(cut.px, stencil.px), [clip, OCTAGON]);
    });
  }

  it('cuts a turned item across a rect clip, and nested convex clips, in one run', () => {
    const rectClip = { kind: 'rect' as const, x: 20.53, y: 15.47, width: 50.21, height: 40.9 };
    const across = turned(48, 40, 30, 90, 20);
    const outer = turned(48, 40, 70, 50, 15);
    const inner = turned(50, 38, 40, 60, -35);
    const nested = [solid('#202020'), clipped(rectClip, [
      solid('#00ff00', across),
      clipped(outer, [clipped(inner, [solid('#ff0000')])]),
    ])];
    const cut = paint(nested);
    const stencil = paint(nested, false);
    expect(cut.draws).toBe(1);
    expect(stencil.draws).toBeGreaterThan(1);
    expectEdgeSamplesOnly(diff(cut.px, stencil.px), [rectClip, outer, inner, across]);
  });

  it('keeps the stencil for a clip that is not convex', () => {
    const notch = pathFromD('M 10 10 L 86 10 L 86 70 L 48 30 L 10 70 Z');
    const frame = [solid('#202020'), clipped(notch, [solid('#ff0000')])];
    expect(paint(frame).draws).toBeGreaterThan(1);
  });
});
