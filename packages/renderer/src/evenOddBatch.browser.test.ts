/**
 * An even-odd fill is triangulated and joins the run, its crossings and
 * contacts resolved first where its outlines meet; only one too costly to
 * resolve keeps the stencil. Only a real rasterizer says whether the
 * triangulation lands on the pixels the stencil's parity passes did, edges and
 * multisamples included.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
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

function paint(commands: DrawCommand[], antialias: boolean): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true, antialias })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderers.push(r);
  r.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, draws: r.lastFrameStats().drawCalls };
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

const evenOdd = (d: string): PolygonPath => ({ ...pathFromD(d), fillRule: 'evenodd' } as PolygonPath);

/** A backdrop and a marker either side of the fill: a fill that joins the run
 *  leaves the frame one draw. */
function frame(path: PolygonPath): DrawCommand[] {
  return [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#202020' } } },
    { kind: 'path', path, fill: { paint: { color: 'rgba(255, 0, 0, 0.75)' } } },
    { kind: 'path', path: { kind: 'rect', x: 2, y: 2, width: 6, height: 6 }, fill: { paint: { color: '#00ff00' } } },
  ];
}

const CIRCLE_RING = 'M 48 6 C 70 6 86 22 86 40 C 86 58 70 74 48 74 C 26 74 10 58 10 40 C 10 22 26 6 48 6 Z '
  + 'M 48 20 C 37 20 28.5 29 28.5 40 C 28.5 51 37 60 48 60 C 59 60 67.5 51 67.5 40 C 67.5 29 59 20 48 20 Z';

const SIMPLE: [string, string][] = [
  ['a turned square', 'M 48.3 6.2 L 82.1 40.7 L 47.6 73.9 L 13.8 39.4 Z'],
  ['a concave arrow', 'M 10 30 L 60 30 L 60 12 L 88 40 L 60 68 L 60 50 L 10 50 Z'],
  ['a square ring wound one way', 'M 8 8 L 88 8 L 88 72 L 8 72 Z M 28 24 L 68 24 L 68 56 L 28 56 Z'],
  ['a square ring wound both ways', 'M 8 8 L 88 8 L 88 72 L 8 72 Z M 28 24 L 28 56 L 68 56 L 68 24 Z'],
  ['a curved ring', CIRCLE_RING],
  ['an island in a hole', 'M 4 4 L 92 4 L 92 76 L 4 76 Z M 20 16 L 76 16 L 76 64 L 20 64 Z M 36.5 28.5 L 59.5 28.5 L 59.5 51.5 L 36.5 51.5 Z'],
  ['two shapes apart', 'M 6 10 L 40 10 L 23 70 Z M 50 10 L 90 10 L 90 70 L 50 70 Z'],
  ['a sliver a pixel wide', 'M 10 10 L 86 60 L 85.2 61.1 L 9.3 11.2 Z'],
];

const MEETING: [string, string][] = [
  ['two squares that overlap', 'M 8 8 L 60 8 L 60 60 L 8 60 Z M 36 20 L 88 20 L 88 72 L 36 72 Z'],
  ['a star that crosses itself', 'M 48 4 L 69 70 L 13 29 L 83 29 L 27 70 Z'],
  ['a hole touching its outline', 'M 8 8 L 88 8 L 88 72 L 8 72 Z M 8 24 L 48 24 L 48 56 L 8 56 Z'],
  ['two squares sharing a corner', 'M 8 8 L 48 8 L 48 40 L 8 40 Z M 48 40 L 88 40 L 88 72 L 48 72 Z'],
  ['a square on another\'s edge', 'M 8 8 L 48 8 L 48 72 L 8 72 Z M 48 24 L 88 24 L 88 56 L 48 56 Z'],
  ['a figure eight', 'M 10 10 L 86 70 L 86 10 L 10 70 Z'],
];

describe('an even-odd fill, in a real context', () => {
  for (const antialias of [false, true]) {
    for (const [name, d] of [...SIMPLE, ...MEETING]) {
      it(`joins the run and keeps the stencil's pixels: ${name}${antialias ? ', multisampled' : ''}`, () => {
        const batched = paint(frame(evenOdd(d)), antialias);
        const stencil = paint(frame(stencilledEvenOdd(evenOdd(d))), antialias);
        expect(batched.draws).toBe(1);
        expect(stencil.draws).toBeGreaterThan(1);
        expect(covered(batched.px)).toBeGreaterThan(0);
        const off = differing(batched.px, stencil.px);
        // A crossing is a computed point, not one the rasterizer can hold, so
        // on a multisampled buffer a sample that close to it can go either way.
        const meets = MEETING.some(([n]) => n === name);
        if (antialias && meets) expect(off.length, off.join(' ')).toBeLessThanOrEqual(4);
        else expect(off).toEqual([]);
      });
    }
  }

  it('paints a translucent fill once where its fan overlaps itself', () => {
    // The fan from the arrow's tail covers its shaft three times over here.
    const { px } = paint(frame(stencilledEvenOdd(evenOdd(SIMPLE[1][1]))), false);
    const i = ((H - 1 - 49) * W + 36) * 4;
    expect(Array.from(px.slice(i, i + 4))).toEqual([199, 8, 8, 255]);
  });

  it('leaves the region two contours share empty', () => {
    const { px } = paint([{ kind: 'path', path: evenOdd(MEETING[0][1]), fill: { paint: { color: '#ff0000' } } }], false);
    const alpha = (x: number, y: number): number => px[((H - 1 - y) * W + x) * 4 + 3];
    expect(alpha(20, 14)).toBe(255);
    expect(alpha(48, 40)).toBe(0);
    expect(alpha(80, 66)).toBe(255);
  });
});
