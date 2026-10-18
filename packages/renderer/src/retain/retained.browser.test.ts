/**
 * A group carrying `retain`, against real WebGL2: its composite has to put the
 * same pixels on the canvas that drawing the group would have, in a
 * multisampled context, through clips, even-odd fills, gradients, strokes and
 * translucency. The whole buffer is compared channel by channel, so the
 * pixels the group leaves empty are checked as well as the ones it covers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { WeaselRendererOptions } from '../rendererTypes';
import { registerTexture, unregisterTexture } from '../textures/registerTexture';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';

const W = 48;
const H = 32;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;

const CIRCLE = pathFromD('M24 4 A12 12 0 1 1 23.99 4 Z');
const RING = { ...pathFromD('M4 4 L20 4 L20 20 L4 20 Z M8 8 L16 8 L16 16 L8 16 Z'), fillRule: 'evenodd' as const };

const BELOW: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
  { kind: 'path', path: pathFromD('M40 2 A8 8 0 1 1 39.99 2 Z'), fill: { paint: { color: '#ffcc00' } } },
];

/** A few of everything that draws differently, built fresh per call so a
 *  test can hand the renderer a new array. */
function content(): DrawCommand[] {
  return [
    { kind: 'path', path: CIRCLE, fill: { paint: { color: 'rgba(255, 0, 0, 0.6)' } } },
    { kind: 'path', path: RING, fill: { paint: { color: '#00ff88' } } },
    {
      kind: 'group',
      transform: mat3.fromAffine([Math.cos(0.4), Math.sin(0.4), -Math.sin(0.4), Math.cos(0.4), 0, 0]),
      children: [{
        kind: 'path',
        path: { kind: 'rect', x: 20, y: 0, width: 14, height: 6 },
        fill: {
          paint: {
            kind: 'linear-gradient', from: { x: 20, y: 0 }, to: { x: 34, y: 0 },
            stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: 'rgba(255, 255, 255, 0.5)' }],
          },
        },
      }],
    },
    {
      kind: 'group',
      clip: pathFromD('M30 16 A10 10 0 1 1 29.99 16 Z'),
      alpha: 0.7,
      children: [{ kind: 'path', path: { kind: 'rect', x: 22, y: 10, width: 24, height: 20 }, fill: { paint: { color: '#ff00ff' } } }],
    },
    { kind: 'path', path: pathFromD('M2 30 L46 22'), stroke: { paint: { color: '#ffffff' }, width: 1.5 } },
  ];
}

const ABOVE: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 10, y: 12, width: 6, height: 6 }, fill: { paint: { color: 'rgba(0, 0, 0, 0.5)' } },
};

let renderer: WeaselRenderer | undefined;
let gl: WebGL2RenderingContext;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function open(opts: Partial<WeaselRendererOptions> = {}): WeaselRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = DW;
  canvas.height = DH;
  gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR, ...opts });
  return renderer;
}

function frame(r: WeaselRenderer, commands: DrawCommand[]): Uint8Array {
  r.render(commands);
  const px = new Uint8Array(DW * DH * 4);
  gl.readPixels(0, 0, DW, DH, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** The largest per-channel difference anywhere in the buffer. */
function maxDiff(a: Uint8Array, b: Uint8Array): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

function channelsOver(a: Uint8Array, b: Uint8Array, limit: number): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > limit) n++;
  return n;
}

function stack(layer: GroupDrawCommand): DrawCommand[] {
  return [...BELOW, layer, ABOVE];
}

const TRANSFORM = mat3.translated(mat3.identity(), 1.25, 0.5);

describe('a retained group, in a real context', () => {
  it('composites the pixels drawing it would have left, on the frame it is drawn and after', () => {
    const children = content();
    const r = open();
    const direct = frame(r, stack({ kind: 'group', transform: TRANSFORM, children }));

    const drawn = frame(r, stack({ kind: 'group', transform: TRANSFORM, retain: 'layer', children }));
    expect(r.lastFrameStats().retained).toMatchObject({ redrawn: 1, composited: 0 });
    const kept = frame(r, stack({ kind: 'group', transform: TRANSFORM, retain: 'layer', children }));
    expect(r.lastFrameStats().retained).toMatchObject({ redrawn: 0, composited: 1 });

    expect(maxDiff(drawn, kept)).toBe(0);
    // Translucent pixels round once more, through the surface's 8 bits, than
    // they do blended straight onto the canvas.
    expect(maxDiff(direct, drawn)).toBeLessThanOrEqual(1);
  });

  it('matches drawing it under an enclosing alpha, color matrix and clip', () => {
    const children = content();
    const clip = pathFromD('M2 2 L44 6 L40 30 L6 26 Z');
    const outer = (inner: GroupDrawCommand): GroupDrawCommand => ({
      kind: 'group',
      alpha: 0.8,
      colorMatrix: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      clip,
      children: [inner],
    });
    const r = open();
    const direct = frame(r, stack(outer({ kind: 'group', children })));
    frame(r, stack(outer({ kind: 'group', retain: 'layer', children })));
    const kept = frame(r, stack(outer({ kind: 'group', retain: 'layer', children })));
    expect(r.lastFrameStats().retained.composited).toBe(1);
    // Alpha compounding through two groups costs a second level of rounding.
    // Past that, only where an edge of the layer crosses one drawn beneath it
    // in the same pixel: the surface is resolved before it meets them, so
    // their samples no longer pair up. Here that is 3 channels at one pixel,
    // where the red circle's rim crosses the yellow one's.
    expect(channelsOver(direct, kept, 2)).toBeLessThanOrEqual(3);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(6);
  });

  it('draws again for new children, a moved transform, or a texture registered since', async () => {
    const r = open();
    const children = content();
    frame(r, stack({ kind: 'group', retain: 'layer', children }));

    frame(r, stack({ kind: 'group', retain: 'layer', children: content() }));
    expect(r.lastFrameStats().retained.redrawn).toBe(1);

    const moved = frame(r, stack({ kind: 'group', retain: 'layer', transform: TRANSFORM, children }));
    expect(r.lastFrameStats().retained.redrawn).toBe(1);
    expect(maxDiff(moved, frame(r, stack({ kind: 'group', transform: TRANSFORM, children })))).toBeLessThanOrEqual(1);

    // The frame drawn straight through freed the surface.
    frame(r, stack({ kind: 'group', retain: 'layer', transform: TRANSFORM, children }));
    frame(r, stack({ kind: 'group', retain: 'layer', transform: TRANSFORM, children }));
    expect(r.lastFrameStats().retained.composited).toBe(1);
    const handle = registerTexture(await createImageBitmap(new ImageData(1, 1)));
    frame(r, stack({ kind: 'group', retain: 'layer', transform: TRANSFORM, children }));
    expect(r.lastFrameStats().retained.redrawn).toBe(1);
    unregisterTexture(handle);
  });

  it('frees its surface on the first frame that does not draw it', () => {
    const r = open();
    const children = content();
    frame(r, stack({ kind: 'group', retain: 'layer', children }));
    // The surface and the 4x scratch it was drawn in.
    expect(r.lastFrameStats().retained.bytes).toBeGreaterThanOrEqual(DW * DH * 4 * 2);
    frame(r, stack({ kind: 'group', children }));
    expect(r.lastFrameStats().retained.bytes).toBe(0);
  });

  it('draws again when an enclosing clip changes', () => {
    const r = open();
    const children = content();
    const clipped = (clip: GroupDrawCommand['clip']): DrawCommand[] =>
      stack({ kind: 'group', clip, children: [{ kind: 'group', retain: 'layer', children }] });
    const clip = pathFromD('M2 2 L44 6 L40 30 L6 26 Z');
    frame(r, clipped(clip));
    frame(r, clipped(clip));
    expect(r.lastFrameStats().retained.composited).toBe(1);
    frame(r, clipped(pathFromD('M2 2 L44 6 L40 30 L6 26 Z')));
    expect(r.lastFrameStats().retained.redrawn).toBe(1);
  });

  it('composites into a tile of a larger buffer, leaving the rest of it alone', () => {
    const children = content();
    const canvas = document.createElement('canvas');
    canvas.width = DW * 2;
    canvas.height = DH;
    gl = canvas.getContext('webgl2', { stencil: true })!;
    const r = renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR });
    r.setTarget({ origin: { x: W, y: 0 } });
    const read = (commands: DrawCommand[]): Uint8Array => {
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0.2, 0.4, 0.6, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      r.render(commands);
      const px = new Uint8Array(DW * 2 * DH * 4);
      gl.readPixels(0, 0, DW * 2, DH, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const direct = read(stack({ kind: 'group', children }));
    read(stack({ kind: 'group', retain: 'layer', children }));
    const kept = read(stack({ kind: 'group', retain: 'layer', children }));
    expect(r.lastFrameStats().retained.composited).toBe(1);
    // The one pixel past rounding is the rims crossing, as above.
    expect(channelsOver(direct, kept, 1)).toBeLessThanOrEqual(3);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(8);
  });

  it('draws straight through past its budget, and leaves the same pixels', () => {
    const children = content();
    const r = open({ retainBudget: 0 });
    const direct = frame(r, stack({ kind: 'group', children }));
    const declined = frame(r, stack({ kind: 'group', retain: 'layer', children }));
    expect(r.lastFrameStats().retained).toMatchObject({ declined: 1, redrawn: 0, bytes: 0 });
    expect(maxDiff(direct, declined)).toBe(0);
  });

  it('draws straight through over a tree that composites with anything but source-over', () => {
    const children: DrawCommand[] = [
      ...content(),
      { kind: 'group', composite: 'destination-out', children: [ABOVE] },
    ];
    const r = open();
    const direct = frame(r, stack({ kind: 'group', children }));
    const declined = frame(r, stack({ kind: 'group', retain: 'layer', children }));
    expect(r.lastFrameStats().retained.declined).toBe(1);
    expect(maxDiff(direct, declined)).toBe(0);
  });
});
