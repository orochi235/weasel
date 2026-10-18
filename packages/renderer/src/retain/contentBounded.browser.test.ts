/**
 * A retained group's surface covers only the device pixels it can paint, and
 * is composited over just those. Against real WebGL2: the whole buffer is
 * compared channel by channel with drawing the group straight through, so a
 * surface placed a pixel off, cut short at its edge, or composited over pixels
 * it does not cover all show — and single pixels are probed inside the rect,
 * outside it, and at the edge of the buffer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';

const W = 48;
const H = 32;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;

const GROUND: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
  { kind: 'path', path: { kind: 'rect', x: 30, y: 2, width: 16, height: 8 }, fill: { paint: { color: '#ffcc00' } } },
];

let renderer: WeaselRenderer | undefined;
let gl: WebGL2RenderingContext;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function open(width = DW, height = DH): WeaselRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR });
  return renderer;
}

function read(r: WeaselRenderer, commands: DrawCommand[], width = DW, height = DH): Uint8Array {
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0.1, 0.8, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  r.render(commands);
  const px = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

function maxDiff(a: Uint8Array, b: Uint8Array): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

/** The pixel at device (x, y) from the top left of a `width`-wide buffer. */
function at(px: Uint8Array, x: number, y: number, width = DW, height = DH): number[] {
  const i = ((height - 1 - y) * width + x) * 4;
  return [px[i], px[i + 1], px[i + 2], px[i + 3]];
}

/** Draw `layer` straight through, then retained twice; the pixels each left. */
function compare(r: WeaselRenderer, layer: (retain?: string) => GroupDrawCommand, width = DW, height = DH) {
  const direct = read(r, [...GROUND, layer()], width, height);
  read(r, [...GROUND, layer('layer')], width, height);
  const kept = read(r, [...GROUND, layer('layer')], width, height);
  return { direct, kept, stats: r.lastFrameStats().retained };
}

describe('a content-bounded retained surface, in a real context', () => {
  it('covers only its content, and leaves every pixel outside alone', () => {
    const children: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 10, y: 12, width: 8, height: 6 }, fill: { paint: { color: 'rgba(255, 0, 0, 0.6)' } } },
      { kind: 'path', path: pathFromD('M14 8 L22 20'), stroke: { paint: { color: '#ffffff' }, width: 1 } },
    ];
    const r = open();
    const { direct, kept, stats } = compare(r, (retain) => ({ kind: 'group', retain, children }));
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    // Inside the rect, the content; outside it, the ground, untouched.
    expect(at(kept, 28, 30)).toEqual(at(direct, 28, 30));
    expect(at(kept, 28, 30)[0]).toBeGreaterThan(150);
    expect(at(kept, 4, 4)).toEqual([0x33, 0x66, 0x99, 255]);
    expect(at(kept, 80, 10)).toEqual([0xff, 0xcc, 0x00, 255]);
    // The rect is the stroke's reach plus a pixel, about a quarter of the
    // buffer; a surface and its scratch at the buffer's size cost all of it.
    const samples = gl.getParameter(gl.SAMPLES) as number;
    const perPixel = 4 + Math.max(1, samples) * 8;
    expect(stats.bytes).toBeLessThan((DW * DH * perPixel) / 3);
  });

  it('keeps content running off the edge of the buffer up to that edge', () => {
    const children: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 40, y: 24, width: 20, height: 20 }, fill: { paint: { color: '#ff00ff' } } },
      { kind: 'path', path: pathFromD('M-4 -4 L6 6'), stroke: { paint: { color: '#00ff00' }, width: 2 } },
    ];
    const r = open();
    const { direct, kept } = compare(r, (retain) => ({ kind: 'group', retain, children }));
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    expect(at(kept, DW - 1, DH - 1)).toEqual([0xff, 0x00, 0xff, 255]);
    expect(at(kept, 0, 0)[1]).toBeGreaterThan(200);
  });

  it('draws inside the clips around it, and an isolated group within it', () => {
    const children: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#ff0000' } } },
      {
        kind: 'group', isolate: true, alpha: 0.5,
        children: [{ kind: 'path', path: { kind: 'rect', x: 16, y: 10, width: 12, height: 12 }, fill: { paint: { color: '#0000ff' } } }],
      },
    ];
    const clip = pathFromD('M12 6 A10 10 0 1 1 11.99 6 Z');
    const r = open();
    const { direct, kept, stats } = compare(r, (retain) => ({ kind: 'group', retain, clip, children }));
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    expect(at(kept, 2, 2)).toEqual([0x33, 0x66, 0x99, 255]);
  });

  it('composites into a tile of a larger buffer at the tile\'s offset', () => {
    const children: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 6, y: 20, width: 10, height: 10 }, fill: { paint: { color: '#00ffff' } } },
    ];
    const r = open(DW * 2, DH);
    r.setTarget({ origin: { x: W, y: 0 } });
    const { direct, kept, stats } = compare(r, (retain) => ({ kind: 'group', retain, children }), DW * 2, DH);
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBe(0);
    expect(at(kept, DW + 20, 50, DW * 2)).toEqual([0x00, 0xff, 0xff, 255]);
    // The other half of the buffer is the clear color, never drawn.
    expect(at(kept, 20, 50, DW * 2)).toEqual(at(direct, 20, 50, DW * 2));
  });

  it('draws again at the new size when its content grows', () => {
    const small: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 4, y: 4, width: 4, height: 4 }, fill: { paint: { color: '#ffffff' } } },
    ];
    const large: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 4, y: 4, width: 30, height: 20 }, fill: { paint: { color: '#ffffff' } } },
    ];
    const r = open();
    compare(r, (retain) => ({ kind: 'group', retain, children: small }));
    const before = r.lastFrameStats().retained.bytes;
    const { direct, kept } = compare(r, (retain) => ({ kind: 'group', retain, children: large }));
    expect(r.lastFrameStats().retained.bytes).toBeGreaterThan(before);
    expect(maxDiff(direct, kept)).toBe(0);
  });

  it('keeps nothing for content wholly off the buffer, and draws nothing for it', () => {
    const children: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 100, y: 100, width: 10, height: 10 }, fill: { paint: { color: '#ffffff' } } },
    ];
    const r = open();
    const { direct, kept, stats } = compare(r, (retain) => ({ kind: 'group', retain, children }));
    expect(stats).toMatchObject({ composited: 1, bytes: 0 });
    expect(maxDiff(direct, kept)).toBe(0);
  });
});
