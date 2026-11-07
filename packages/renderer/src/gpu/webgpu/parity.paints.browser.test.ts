/**
 * WebGL and WebGPU in one page, for what samples a texture or a ramp and what
 * comes back out: pattern wrap and filtering, every image minification mode,
 * gradient ramps across their interpolation spaces, text under each glyph
 * paint, batches holding many alphas and color matrices (the kit programs'
 * uniform arrays), and the canvas and ids read back. Each case logs its line
 * of the parity table.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD } from '@weasel-js/geom';
import { composePatternTransform } from '@weasel-js/paint';
import { registerFont } from '@weasel-js/font';
import { registerTexture, unregisterTexture, type TextureHandle } from '@weasel-js/renderer';
import type { DrawCommand } from '../../DrawCommand';
import type { ImageMinification } from '../../cache/GLImageCache';
import {
  closeBackends, diff, openBackends, parityDevice, releaseDevice, renderBoth, renderEach, report, requireGpu,
} from '@weasel-js/renderer/testing/parityHarness';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';

const W = 64;
const H = 48;
const FAMILY = 'parity-paints-inter';

const GROUND: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#f4efe6' } },
};

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color } },
});

const registered: TextureHandle[] = [];

afterAll(() => releaseDevice());
beforeAll(async () => {
  await parityDevice();
  await registerFont(FAMILY, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
});
beforeEach(requireGpu);
afterEach(() => {
  closeBackends();
  for (const h of registered.splice(0)) unregisterTexture(h);
});

async function expectParity(name: string, commands: DrawCommand[], dpr = 1): Promise<void> {
  const b = await openBackends({ width: W, height: H, dpr });
  const d = await renderBoth(b, [GROUND, ...commands]);
  const line = report(name, d);
  expect(d.over, line).toBe(0);
}

async function bitmap(
  width: number, height: number, texel: (x: number, y: number) => number[], options?: ImageBitmapOptions,
): Promise<ImageBitmap> {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(texel(x, y), (y * width + x) * 4);
  return createImageBitmap(new ImageData(data, width, height), options);
}

/** A checker with a translucent corner: aliasing, filtering and premultiplying all show on it. */
const checker = (cell: number) => (x: number, y: number) => {
  const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
  return on ? [230, 40, 60, x < cell && y < cell ? 128 : 255] : [20, 60, 200, 255];
};

const text = (fill: unknown): DrawCommand => ({
  kind: 'text', x: 4, y: 8,
  runs: [{
    text: 'Wg', fontFamily: FAMILY, fontSize: 30, fontWeight: 400, fontStyle: 'normal', fill,
    letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
  }],
  style: {},
} as DrawCommand);

const STOPS = [{ offset: 0, color: '#ff0000' }, { offset: 0.3, color: 'rgba(0, 255, 0, 0.4)' }, { offset: 1, color: '#2020ff' }];

describe('WebGL and WebGPU sample and read back the same', () => {
  it('a pattern tiled, shrunk and rotated', async () => {
    const tile = registerTexture(await bitmap(8, 8, checker(2)));
    registered.push(tile);
    await expectParity('pattern wrap and minification', [
      { kind: 'path', path: { kind: 'rect', x: 2, y: 2, width: 28, height: 44 }, fill: { paint: { kind: 'texture', texture: tile, width: 7, height: 11 } } },
      { kind: 'path', path: { kind: 'rect', x: 32, y: 2, width: 30, height: 20 }, fill: { paint: { kind: 'texture', texture: tile, width: 3, height: 3 } } },
      {
        kind: 'path', path: pathFromD('M34 26 L62 28 L58 46 L36 44 Z'),
        fill: { paint: { kind: 'texture', texture: tile, width: 9, height: 6, origin: { x: 1.5, y: 0.25 }, transform: composePatternTransform({ rotation: 0.6 }) } },
      },
    ] as DrawCommand[]);
  });

  it.each<ImageMinification>(['linear', 'mipmap', 'auto'])('an image shrunk under %s minification', async (mode) => {
    const image = await bitmap(64, 64, checker(3));
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    for (const r of [b.gl, b.gpu]) r.setImageMinification(mode);
    const commands = [GROUND,
      { kind: 'image', image, x: 2, y: 2, w: 13, h: 11 },
      { kind: 'image', image, x: 20, y: 4, w: 24, h: 24, opacity: 0.7 },
      { kind: 'image', image, x: 48, y: 30, w: 9, h: 15, sampling: 'nearest' },
    ] as DrawCommand[];
    // `auto` builds mipmaps once an image has been drawn shrunk: compare the frame after.
    await renderBoth(b, commands);
    const d = await renderBoth(b, commands);
    const line = report(`image minification ${mode}`, d);
    expect(d.over, line).toBe(0);
  });

  it('a straight-alpha bitmap draws as its premultiplied twin does, as an image and as a pattern', async () => {
    const translucent = (x: number, y: number) => [40 + x * 20, 200 - y * 20, 230, 40 + (x + y) * 12];
    const scene = async (options?: ImageBitmapOptions): Promise<DrawCommand[]> => {
      const tile = registerTexture(await bitmap(8, 8, translucent, options));
      registered.push(tile);
      return [GROUND,
        { kind: 'image', image: await bitmap(8, 8, translucent, options), x: 2, y: 2, w: 28, h: 28 },
        { kind: 'path', path: { kind: 'rect', x: 34, y: 2, width: 28, height: 44 }, fill: { paint: { kind: 'texture', texture: tile, width: 8, height: 8 } } },
      ] as DrawCommand[];
    };
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const straight = await renderEach(b, await scene({ premultiplyAlpha: 'none' }));
    const twin = await renderEach(b, await scene());
    const parity = diff(straight.gl, straight.gpu, W);
    expect(parity.over, report('straight-alpha bitmap', parity)).toBe(0);
    for (const backend of ['gl', 'gpu'] as const) {
      const d = diff(straight[backend], twin[backend], W);
      expect(d.over, report(`straight-alpha bitmap against its twin on ${backend}`, d)).toBe(0);
    }
  });

  it.each(['rgb', 'oklab', 'oklch'])('gradient ramps interpolated in %s', async (interpolate) => {
    await expectParity(`gradient ramps (${interpolate})`, [
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 64, height: 16 }, fill: { paint: { kind: 'linear-gradient', from: { x: 2, y: 0 }, to: { x: 62, y: 0 }, stops: STOPS, interpolate } } },
      { kind: 'path', path: { kind: 'rect', x: 0, y: 16, width: 32, height: 32 }, fill: { paint: { kind: 'radial-gradient', center: { x: 16, y: 32 }, radius: 18, stops: STOPS, interpolate, opacity: 0.7 } } },
      { kind: 'path', path: { kind: 'rect', x: 32, y: 16, width: 32, height: 32 }, fill: { paint: { kind: 'conic-gradient', center: { x: 48, y: 32 }, angle: -1.1, stops: STOPS, interpolate } } },
    ] as DrawCommand[]);
  });

  it('text filled with a gradient, a pattern and a translucent solid', async () => {
    const tile = registerTexture(await bitmap(4, 4, checker(1)));
    registered.push(tile);
    const b = await openBackends({ width: W, height: H, dpr: 2 });
    const d = await renderBoth(b, [GROUND,
      text({ paint: { kind: 'linear-gradient', from: { x: 4, y: 0 }, to: { x: 40, y: 0 }, stops: STOPS } }),
      { kind: 'group', transform: mat3.translated(mat3.identity(), 24, 14), children: [text({ paint: { kind: 'texture', texture: tile, width: 3, height: 3 } })] },
      { kind: 'group', transform: mat3.translated(mat3.identity(), 34, 0), children: [text({ paint: { kind: 'solid', color: 'rgba(20, 20, 20, 0.5)' } })] },
    ] as DrawCommand[]);
    expect(d.over, report('text under each glyph paint', d)).toBe(0);
  });

  it('one batch run holding many alphas and color matrices', async () => {
    const children: DrawCommand[] = [];
    for (let i = 0; i < 12; i++) {
      const x = (i % 6) * 10 + 2;
      const y = Math.floor(i / 6) * 22 + 3;
      children.push({
        kind: 'group', alpha: 0.25 + i * 0.06,
        ...(i % 3 === 0 && { colorMatrix: [0.3, 0.6, 0.1, 0, 0.1 * (i / 12), 0.3, 0.6, 0.1, 0, 0, 0.3, 0.6, 0.1, 0, 0.2, 0, 0, 0, 1, 0] }),
        children: [rect(x, y, 9, 20, `rgb(${40 + i * 17}, ${200 - i * 12}, ${60 + i * 10})`)],
      });
    }
    await expectParity('batch alphas and color matrices', children);
  });

  it('readPixels hands back the same premultiplied rows, top first', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const commands = [rect(0, 0, W, 10, 'rgba(255, 0, 0, 0.5)'), rect(0, 10, W, 38, 'rgba(0, 120, 255, 0.25)'), rect(40, 0, 24, H, '#00a050')];
    for (const r of [b.gl, b.gpu]) r.render(commands);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rect2 = { x: 3, y: 5, width: 50, height: 30 };
    const [gl, gpu] = [await b.gl.readPixels(rect2), await b.gpu.readPixels(rect2)];
    const d = diff(gl, gpu, rect2.width);
    const line = report('readPixels sub-rect', d);
    expect(Array.from(gl.subarray(0, 4)), line).toEqual([128, 0, 0, 128]);
    expect(d.over, line).toBe(0);
  });

  it('an id read of an off-center rect at dpr 2 names the same pixels', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 2 });
    const commands: DrawCommand[] = [
      { kind: 'group', pickId: 7, children: [{ kind: 'path', path: pathFromD('M2 2 L40 4 L6 40 Z'), fill: { paint: { color: '#ff0000' } } }] },
      { kind: 'group', pickId: 9, children: [rect(30, 20, 30, 26, 'rgba(0, 0, 255, 0.5)')] },
    ];
    const opts = { rect: { x: 5.5, y: 3.25, width: 40, height: 30 } };
    const [gl, gpu] = [await b.gl.renderIdsAsync(commands, undefined, opts), await b.gpu.renderIdsAsync(commands, undefined, opts)];
    expect({ ...gpu, data: undefined }).toEqual({ ...gl, data: undefined });
    let over = 0;
    for (let i = 0; i < gl.data.length; i++) if (gl.data[i] !== gpu.data[i]) over++;
    const line = report('ids of an off-center rect', { max: over > 0 ? 1 : 0, over, first: [] });
    expect(new Set(gl.data).size, line).toBe(3);
    expect(over, line).toBe(0);
  });
});
