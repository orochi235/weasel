/**
 * A pattern fill rides the batch: its tile coordinate goes into the vertices
 * and its tile into a slot of the run, uploaded to repeat. Against real WebGL2
 * it has to share one draw with the solids around it and paint the texels
 * the pattern program painted, tiled, under group alpha and a color matrix.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import { registerTexture, unregisterTexture, type TextureHandle } from './textures/registerTexture';
import type { DrawCommand } from './DrawCommand';
import { mat3 } from '@weasel-js/geom';

const W = 16;
const H = 4;

let renderer: WeaselRenderer | undefined;
const registered: TextureHandle[] = [];
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  for (const h of registered.splice(0)) unregisterTexture(h);
});

let draws = 0;

function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: false })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  draws = 0;
  const drawElements = gl.drawElements.bind(gl);
  gl.drawElements = (...args: Parameters<typeof drawElements>): void => {
    draws++;
    drawElements(...args);
  };
  renderer.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((H - 1 - y) * W + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

/** Texel colors of the 2x2 tile, row by row. */
const TEXELS = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];

/** A 2x2 opaque tile, one texel a unit, so every pixel center lands on a
 *  texel center and the filter has nothing to blend. */
async function tile(): Promise<TextureHandle> {
  const data = new Uint8ClampedArray(TEXELS.flatMap((c) => [...c, 255]));
  const handle = registerTexture(await createImageBitmap(new ImageData(data, 2, 2)));
  registered.push(handle);
  return handle;
}

/** The texel the tile puts at pixel `(x, y)`. */
const texelAt = (x: number, y: number): number[] => TEXELS[(y % 2) * 2 + (x % 2)];

const patternRect = (texture: TextureHandle, x: number, w: number, extra: object = {}): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: w, height: H },
  fill: { paint: { kind: 'texture', texture, width: 2, height: 2, ...extra } },
} as DrawCommand);

const solid = (x: number, w: number, color = '#00ff00'): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: w, height: H },
  fill: { paint: { color } },
});

function expectNear(got: number[], want: number[], tol = 2): void {
  for (let k = 0; k < want.length; k++) expect(Math.abs(got[k] - want[k])).toBeLessThanOrEqual(tol);
}

describe('a pattern in the batch, in a real context', () => {
  it('shares one draw with the solids either side and tiles its texels', async () => {
    const at = paint([solid(0, 4), patternRect(await tile(), 4, 8), solid(12, 4, '#ffff00')]);
    expect(draws).toBe(1);
    expectNear(at(1, 2), [0, 255, 0, 255]);
    for (let x = 4; x < 12; x++) for (const y of [0, 1, 3]) expectNear(at(x, y), [...texelAt(x, y), 255]);
    expectNear(at(14, 2), [255, 255, 0, 255]);
  });

  it('shows through where a solid staged after it does not cover it', async () => {
    const at = paint([patternRect(await tile(), 0, 16), solid(0, 8)]);
    expect(draws).toBe(1);
    expectNear(at(3, 2), [0, 255, 0, 255]);
    for (const x of [9, 12, 15]) expectNear(at(x, 2), [...texelAt(x, 2), 255]);
  });

  it('takes its opacity and the group alpha after the color matrix', async () => {
    // The matrix lifts alpha to 1 whatever it was, so an opacity folded in
    // before it would vanish.
    const matrix = [
      0, 1, 0, 0, 0,
      1, 0, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 0, 1,
    ];
    const at = paint([
      solid(0, 0.0001),
      { kind: 'group', alpha: 0.5, colorMatrix: matrix, children: [patternRect(await tile(), 0, 16, { opacity: 0.5 })] },
    ]);
    expect(draws).toBe(1);
    for (const x of [0, 1, 6, 11]) {
      const [r, g, b] = texelAt(x, 2);
      // Red and green swapped, premultiplied by 0.25 over a cleared target.
      expectNear(at(x, 2), [g * 0.25, r * 0.25, b * 0.25, 255 * 0.25]);
    }
  });

  it('keeps its texels far from the origin', async () => {
    const texture = await tile();
    const far = 1e7;
    const at = paint([{
      kind: 'group', transform: mat3.translated(mat3.identity(), -far, 0),
      children: [patternRect(texture, far, 16, { units: 'local' })],
    }]);
    for (const x of [0, 1, 7, 14]) expectNear(at(x, 2), [...texelAt(x, 2), 255]);
  });
});
