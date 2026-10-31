/**
 * A convex clip decided in the batch shader against the same clip on the
 * stencil, pixel for pixel. Only a real rasterizer says whether the shader's
 * half-plane test lands on the pixel centers the stencil passes, ties
 * included; the recorder sees neither.
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

interface Frame { px: Uint8Array; draws: number; hulls: boolean }

/**
 * Render `commands` once and read the buffer back. `hulls: false` takes the
 * hull clip away, so every such clip goes on the stencil as it came.
 */
function paint(commands: DrawCommand[], opts: { antialias?: boolean; hulls?: boolean } = {}): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', {
    stencil: true, preserveDrawingBuffer: true, antialias: opts.antialias ?? false,
  })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderers.push(r);
  if (opts.hulls === false) {
    // The stencil as it came: no hull, and no CPU cut standing in for one.
    Object.defineProperty(r._batchVariants(), 'hulls', { value: false });
    Object.defineProperty(r._batchVariants(), 'cuts', { value: false });
  }
  r.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, draws: r.lastFrameStats().drawCalls, hulls: r._batchVariants().hulls };
}

/** Pixels whose channels differ, as `x,y` with a top-left origin. */
function differing(a: Uint8Array, b: Uint8Array): string[] {
  const out: string[] = [];
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
      const p = i / 4;
      out.push(`${p % W},${H - 1 - Math.floor(p / W)}`);
    }
  }
  return out;
}

function covered(px: Uint8Array): number {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
}

/** A rect of `w × h` centered on (cx, cy), turned by `deg`. */
function turned(cx: number, cy: number, w: number, h: number, deg: number): Path {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const corner = (x: number, y: number) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  return polygonFromPoints([corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)]);
}

const FULL = { kind: 'rect' as const, x: 0, y: 0, width: W, height: H };
const solid = (color: string, path: Path = FULL): DrawCommand =>
  ({ kind: 'path', path, fill: { paint: { color } } });
/** An even-odd fill too costly to resolve, which no run can take: it draws for
 *  itself, through the stencil. One convex contour covers what a nonzero one would. */
function ownDraw(path: Path, rgba: number[]): DrawCommand {
  const polygon = path.kind === 'rect'
    ? polygonFromPoints([
      { x: path.x, y: path.y }, { x: path.x + path.width, y: path.y },
      { x: path.x + path.width, y: path.y + path.height }, { x: path.x, y: path.y + path.height },
    ])
    : path;
  const [r, g, b] = rgba.map((v) => Math.round(v * 255));
  return {
    kind: 'path',
    path: stencilledEvenOdd(polygon as PolygonPath),
    fill: { paint: { color: `rgba(${r}, ${g}, ${b}, ${rgba[3]})` } },
  };
}
const half = (left: boolean) => ({ kind: 'rect' as const, x: left ? 0 : W / 2, y: 0, width: W / 2, height: H });
const clipped = (clip: Path, children: DrawCommand[]): DrawCommand => ({ kind: 'group', clip, children });

const CLIPS: [string, Path][] = [
  ...[3, 17, 30, 45, 62, 81].map((deg) => [`a rect turned ${deg} degrees`, turned(48.3, 39.7, 61.2, 37.9, deg)] as [string, Path]),
  // Its edges run through pixel centers, where the tie rule decides.
  ['a diamond whose edges cross pixel centers', pathFromD('M 48.5 8.5 L 80.5 40.5 L 48.5 72.5 L 16.5 40.5 Z')],
  ['a convex pentagon', pathFromD('M 50 5 L 90 30 L 75 75 L 20 70 L 8 28 Z')],
  ['a sliver a pixel wide', pathFromD('M 10 10 L 86 60 L 85.2 61.1 L 9.3 11.2 Z')],
];

describe('a convex clip decided in the batch shader, in a real context', () => {
  it('is offered on a single-sampled buffer only', () => {
    expect(paint([], { antialias: false }).hulls).toBe(true);
    expect(paint([], { antialias: true }).hulls).toBe(false);
  });

  for (const [name, clip] of CLIPS) {
    it(`keeps the pixels the stencil keeps: ${name}`, () => {
      const shader = paint([clipped(clip, [solid('#ff0000')])]);
      const stencil = paint([clipped(clip, [ownDraw(FULL, [1, 0, 0, 1])])]);
      // The premise: the reference really drew for itself.
      expect(stencil.draws).toBeGreaterThan(shader.draws);
      expect(covered(shader.px)).toBeGreaterThan(0);
      expect(differing(shader.px, stencil.px)).toEqual([]);
    });

    it(`shares its edge with an item that draws for itself: ${name}`, () => {
      // Left half batched, right half on the stencil, then batched over both:
      // the seam down the middle must not show where it meets the clip's edge.
      const mixed = paint([solid('#202020'), clipped(clip, [
        solid('#ff0000', half(true)), ownDraw(half(false), [0, 0, 1, 1]), solid('#00ff0080', turned(48, 40, 30, 90, 20)),
      ])]);
      const allStencil = paint([solid('#202020'), clipped(clip, [
        ownDraw(half(true), [1, 0, 0, 1]), ownDraw(half(false), [0, 0, 1, 1]), solid('#00ff0080', turned(48, 40, 30, 90, 20)),
      ])], { hulls: false });
      expect(differing(mixed.px, allStencil.px)).toEqual([]);
    });
  }

  it('lets the run cross the clip', () => {
    const clip = CLIPS[1][1];
    const frame = [solid('#202020'), clipped(clip, [solid('#ff0000')]), solid('#0000ff', { kind: 'rect', x: 4, y: 4, width: 8, height: 8 })];
    expect(paint(frame).draws).toBe(1);
    expect(paint(frame, { hulls: false }).draws).toBeGreaterThan(1);
  });

  it('nests two hulls into one set', () => {
    const outer = turned(48, 40, 70, 50, 15);
    const inner = turned(50, 38, 40, 60, -35);
    const shader = paint([clipped(outer, [clipped(inner, [solid('#ff0000')])])]);
    const stencil = paint([clipped(outer, [clipped(inner, [solid('#ff0000')])])], { hulls: false });
    expect(shader.draws).toBe(1);
    expect(covered(shader.px)).toBeGreaterThan(0);
    expect(differing(shader.px, stencil.px)).toEqual([]);
  });

  it('keeps the stencil for a clip that is not convex', () => {
    const notch = pathFromD('M 10 10 L 86 10 L 86 70 L 48 30 L 10 70 Z');
    const frame = [solid('#202020'), clipped(notch, [solid('#ff0000')])];
    expect(paint(frame).draws).toBe(paint(frame, { hulls: false }).draws);
    expect(differing(paint(frame).px, paint(frame, { hulls: false }).px)).toEqual([]);
  });

  const RECT_CLIPS: [string, Path][] = [
    ['fractional edges', { kind: 'rect', x: 20.53, y: 15.47, width: 50.21, height: 40.9 }],
    ['edges through pixel centers', { kind: 'rect', x: 20.5, y: 15.5, width: 50, height: 41 }],
  ];
  const across = (draw: (color: string, path: Path) => DrawCommand) => [
    draw('#ff0000', { kind: 'rect', x: 0, y: 30, width: W, height: 10 }),
    draw('#00ff00', turned(48, 40, 30, 90, 20)),
    draw('#0000ff', { kind: 'rect', x: 40, y: 0, width: 10, height: H }),
  ];
  const own = (color: string, path: Path) => ownDraw(path, [
    parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255, 1,
  ]);

  for (const [name, clip] of RECT_CLIPS) {
    it(`keeps a slanted item across a rect clip in the run, on the pixels the stencil keeps: ${name}`, () => {
      // Cut on the CPU, tested in the shader, and drawn through the stencil
      // from the same snapped corners: all three must keep the same pixels.
      const shader = paint([solid('#202020'), clipped(clip, across(solid))]);
      const stencil = paint([solid('#202020'), clipped(clip, across(own))]);
      expect(shader.draws).toBe(1);
      expect(covered(shader.px)).toBeGreaterThan(0);
      expect(differing(shader.px, stencil.px)).toEqual([]);
    });
  }

  it('snaps a rect clip only where its edges are off the grid', () => {
    const [, onGrid] = RECT_CLIPS[1];
    const frame = [solid('#202020'), clipped(onGrid, across(solid))];
    expect(differing(paint(frame).px, paint(frame, { hulls: false }).px)).toEqual([]);
  });

  it('on a multisampled buffer, leaves the clip to the CPU cut (planeClip.browser.test.ts)', () => {
    const clip = CLIPS[1][1];
    const frame = [solid('#202020'), clipped(clip, [solid('#ff0000')])];
    expect(paint(frame, { antialias: true }).draws).toBe(1);
  });
});
