/**
 * A convex clip decided in the batch shader against the same clip on the
 * stencil, pixel for pixel. Only a real rasterizer says whether the shader's
 * half-plane test lands on the pixel centers the stencil passes, ties
 * included; the recorder sees neither.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, polygonFromPoints, type Path } from '@weasel-js/geom';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

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
  if (opts.hulls === false) Object.defineProperty(r._batchVariants(), 'hulls', { value: false });
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
/** A fill with per-vertex colors, which no run can take: it draws for itself,
 *  through the stencil. */
const ownDraw = (path: Path, rgba: number[]): DrawCommand =>
  ({ kind: 'path', path, fill: { paint: { color: '#ffffff' } }, vertexColors: Array.from({ length: 4 }, () => rgba).flat() });
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

  it('on a multisampled buffer, keeps the stencil and agrees with it', () => {
    const clip = CLIPS[1][1];
    const shader = paint([clipped(clip, [solid('#ff0000')])], { antialias: true });
    const stencil = paint([clipped(clip, [ownDraw(FULL, [1, 0, 0, 1])])], { antialias: true });
    expect(differing(shader.px, stencil.px)).toEqual([]);
  });
});
