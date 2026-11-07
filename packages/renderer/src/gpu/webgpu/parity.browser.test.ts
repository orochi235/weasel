/**
 * WebGL and WebGPU drawing the same commands in one page, pixel for pixel:
 * fills, strokes, clips, paints, images and text. The visual baselines are
 * Linux captures the fleet cannot reproduce, so this comparison is the
 * evidence the WebGPU backend matches. Every case logs its line of the parity
 * table (`report`) whether or not it passes.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { registerFont } from '@weasel-js/font';
import { registerTexture, unregisterTexture, type TextureHandle } from '../../textures/registerTexture';
import type { DrawCommand } from '../../DrawCommand';
import { closeBackends, openBackends, parityDevice, releaseDevice, renderBoth, report } from '../../testing/parityHarness';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';

const W = 64;
const H = 48;
const FAMILY = 'parity-inter';

const GROUND: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#f4efe6' } },
};

const registered: TextureHandle[] = [];

afterAll(() => releaseDevice());

beforeAll(async () => {
  await parityDevice();
  await registerFont(FAMILY, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
});

afterEach(() => {
  closeBackends();
  for (const h of registered.splice(0)) unregisterTexture(h);
});

/** Compare single-sampled canvases everywhere, or with `antialias`
 *  multisampled ones away from edges, where the two adapters' sample patterns
 *  cannot part them. */
async function expectParity(name: string, commands: DrawCommand[], dpr = 1, antialias = false): Promise<void> {
  const b = await openBackends({ width: W, height: H, dpr, antialias });
  const d = await renderBoth(b, [GROUND, ...commands], undefined, antialias);
  const line = report(name, d);
  expect(d.over, line).toBe(0);
}

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color } },
});

const STOPS = [{ offset: 0, color: '#ff0000' }, { offset: 0.5, color: 'rgba(0, 255, 0, 0.6)' }, { offset: 1, color: '#0000ff' }];

async function bitmap(width: number, height: number, texel: (x: number, y: number) => number[]): Promise<ImageBitmap> {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(texel(x, y), (y * width + x) * 4);
  return createImageBitmap(new ImageData(data, width, height));
}

describe('WebGL and WebGPU draw the same pixels', () => {
  it('solid fills, opaque and translucent, on fractional edges', async () => {
    await expectParity('solid fills', [
      rect(2.3, 3.6, 20.5, 14.2, '#c03020'),
      rect(14.5, 9.25, 30, 20, 'rgba(20, 90, 200, 0.55)'),
      rect(40.1, 30.7, 19.6, 13.3, 'rgba(0, 0, 0, 0.3)'),
    ]);
  });

  it('a filled curve with a stroke', async () => {
    await expectParity('paths with strokes', [{
      kind: 'path', path: pathFromD('M8 40 C 14 2, 40 4, 56 30 L 30 44 Z'),
      fill: { paint: { color: '#3a7d44' } }, stroke: { paint: { color: '#1b1b3a' }, width: 2.5 },
    }, {
      kind: 'path', path: pathFromD('M4 8 Q 30 30, 60 6'), stroke: { paint: { color: 'rgba(200, 40, 120, 0.8)' }, width: 1.3 },
    }], 2);
  });

  it('an even-odd fill', async () => {
    const path = { ...pathFromD('M6 6 L58 6 L58 42 L6 42 Z M18 14 L46 14 L46 34 L18 34 Z M26 20 L38 20 L38 28 L26 28 Z'), fillRule: 'evenodd' } as PolygonPath;
    await expectParity('even-odd fill', [{ kind: 'path', path, fill: { paint: { color: '#7a3cbd' } } }]);
  });

  it('nested curved clips through the stencil', async () => {
    await expectParity('nested curved clip', [{
      kind: 'group', clip: pathFromD('M32 2 A22 22 0 1 1 31.99 2 Z'),
      children: [
        rect(0, 0, W, 24, '#e07020'),
        {
          kind: 'group', clip: pathFromD('M0 30 C 20 0, 44 60, 64 20 L 64 48 L 0 48 Z'),
          children: [rect(0, 0, W, H, '#2060c0'), rect(10, 10, 20, 30, 'rgba(255, 255, 255, 0.5)')],
        },
      ],
    }], 2);
  });

  it('a convex clip', async () => {
    await expectParity('convex clip', [{
      kind: 'group', clip: pathFromD('M6 4 L58 12 L40 44 Z'),
      children: [rect(0, 0, W, H, '#b02050'), rect(20, 0, 10, H, '#20b050')],
    }]);
  });

  it('linear, radial and conic gradients', async () => {
    await expectParity('gradients', [
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 32, height: 24 }, fill: { paint: { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 32, y: 24 }, stops: STOPS } } },
      { kind: 'path', path: { kind: 'rect', x: 32, y: 0, width: 32, height: 24 }, fill: { paint: { kind: 'radial-gradient', center: { x: 48, y: 12 }, radius: 14, stops: STOPS } } },
      { kind: 'path', path: pathFromD('M32 26 A20 20 0 1 1 31.99 26 Z'), fill: { paint: { kind: 'conic-gradient', center: { x: 32, y: 36 }, angle: 0.4, stops: STOPS } } },
    ] as DrawCommand[]);
  });

  it('a pattern', async () => {
    const tile = registerTexture(await bitmap(3, 3, (x, y) => [x * 120, y * 120, 200, (x + y) % 2 ? 255 : 160]));
    registered.push(tile);
    await expectParity('pattern', [{
      kind: 'path', path: pathFromD('M4 4 L60 8 L50 44 L8 40 Z'),
      fill: { paint: { kind: 'texture', texture: tile, width: 5, height: 5 } },
    } as DrawCommand]);
  });

  it('an image, magnified and translucent', async () => {
    const image = await bitmap(4, 4, (x, y) => [x * 80, 255 - y * 60, 90, 120 + 40 * ((x + y) % 4)]);
    await expectParity('image', [
      { kind: 'image', image, x: 6, y: 5, w: 30, h: 26 },
      { kind: 'image', image, x: 40, y: 20, w: 16, h: 16, opacity: 0.6 },
    ] as DrawCommand[]);
  });

  it('text from the SDF atlas', async () => {
    await expectParity('text', [{
      kind: 'text', x: 4, y: 10,
      runs: [{
        text: 'Weasel', fontFamily: FAMILY, fontSize: 18, fontWeight: 400, fontStyle: 'normal',
        fill: { paint: { kind: 'solid', color: '#222222' } }, letterSpacing: 0,
        underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
      style: {},
    } as DrawCommand], 2);
  });

  it('per-vertex colors', async () => {
    await expectParity('vertex colors', [{
      kind: 'path', path: { kind: 'rect', x: 4, y: 4, width: 56, height: 40 },
      fill: { paint: { kind: 'solid', color: '#ffffff' } },
      vertexColors: [1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0.5, 1, 1, 0, 1],
    } as DrawCommand]);
  });

  it('multisampled fills, strokes and a clip, away from their edges', async () => {
    await expectParity('antialiased canvas (interiors)', [
      rect(2.3, 3.6, 20.5, 14.2, '#c03020'),
      { kind: 'path', path: pathFromD('M8 40 C 14 2, 40 4, 56 30 L 30 44 Z'), fill: { paint: { color: 'rgba(58, 125, 68, 0.8)' } }, stroke: { paint: { color: '#1b1b3a' }, width: 3 } },
      { kind: 'group', clip: pathFromD('M40 4 A12 12 0 1 1 39.99 4 Z'), children: [rect(20, 0, 44, 30, '#2060c0')] },
    ], 2, true);
  });

  it('a group under alpha and a color matrix', async () => {
    await expectParity('group alpha and color matrix', [{
      kind: 'group', alpha: 0.6,
      colorMatrix: [0.5, 0, 0, 0, 0.25, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 1, 0],
      children: [rect(4, 4, 30, 30, '#c86432'), rect(20, 16, 40, 28, 'rgba(40, 160, 220, 0.7)')],
    }]);
  });
});
