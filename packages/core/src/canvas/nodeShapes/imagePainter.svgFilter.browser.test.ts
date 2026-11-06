/**
 * An SVG data URL carrying a blur filter and a blend mode draws through
 * `kit:image` with both applied, and a node whose `src` changes draws the new
 * picture: the bitmap is looked up by `src`, not by node. jsdom rasterizes
 * nothing, so only a browser can read the pixels.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  WeaselRenderer, getImageBitmap, releaseImage, subscribeImageReady, type DrawCommand,
} from '@weasel-js/renderer';
import type { Node, RectPose } from 'core/scene/types';
import { IMAGE_PAINTER } from './imagePainter';

const SIZE = 48;
/** A red disc blurred by `feGaussianBlur`, under a blue square that multiplies onto it. */
const svg = (disc: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">`
  + '<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>'
  + `<circle cx="24" cy="24" r="12" fill="${disc}" filter="url(#b)"/>`
  + '<rect x="30" y="30" width="18" height="18" fill="#00f" style="mix-blend-mode:multiply"/></svg>';
const RED = `data:image/svg+xml,${encodeURIComponent(svg('#f00'))}`;
const GREEN = `data:image/svg+xml,${encodeURIComponent(svg('#0f0'))}`;

const POSE: RectPose = { x: 0, y: 0, width: SIZE, height: SIZE };
const nodeOf = (src: string) => ({ id: 'n', kind: 'mark', layer: 'main', parent: null, pose: POSE, data: { image: { src } } }) as
  unknown as Node<unknown, string, RectPose>;

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  releaseImage(RED);
  releaseImage(GREEN);
});

async function loaded(src: string): Promise<void> {
  const deadline = performance.now() + 5000;
  while (getImageBitmap(src) === undefined) {
    if (performance.now() > deadline) throw new Error(`${src.slice(0, 40)} never decoded`);
    await new Promise<void>((resolve) => {
      const off = subscribeImageReady(() => { off(); resolve(); });
      setTimeout(() => { off(); resolve(); }, 100);
    });
  }
}

/** RGBA at (x, y), top-left origin, of `commands` rendered at 1:1. */
function pixels(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer?.dispose();
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const buf = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  return (x, y) => [...buf.slice(((SIZE - 1 - y) * SIZE + x) * 4, ((SIZE - 1 - y) * SIZE + x) * 4 + 4)];
}

describe('an SVG data URL with a blur filter and a blend mode', () => {
  it('draws blurred, and blended where the square covers the disc', async () => {
    await loaded(RED);
    const at = pixels(IMAGE_PAINTER.paint(nodeOf(RED), POSE, { pixelScale: 1 }));
    const [r, g, b, a] = at(24, 24);
    expect(r).toBeGreaterThan(200);
    expect(g! + b!).toBeLessThan(40);
    expect(a).toBeGreaterThan(200);
    // Two units past the disc's edge: unpainted without the blur, partly covered with it.
    const halo = at(24, 24 - 14)[3]!;
    expect(halo).toBeGreaterThan(10);
    expect(halo).toBeLessThan(220);
    // Inside the square, over the blurred disc: multiply darkens red onto blue toward black.
    const [mr, , mb] = at(31, 31);
    expect(mr).toBeLessThan(120);
    expect(mb).toBeLessThan(200);
  });

  it('draws the new picture when the node\'s src changes', async () => {
    await loaded(RED);
    await loaded(GREEN);
    const red = pixels(IMAGE_PAINTER.paint(nodeOf(RED), POSE, { pixelScale: 1 }))(24, 24);
    const green = pixels(IMAGE_PAINTER.paint(nodeOf(GREEN), POSE, { pixelScale: 1 }))(24, 24);
    expect(red[0]).toBeGreaterThan(200);
    expect(green[1]).toBeGreaterThan(200);
    expect(green[0]).toBeLessThan(40);
  });
});
