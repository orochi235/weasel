/**
 * Baked tiles against real WebGL2: content drawn into tiles at a power-of-two scale and drawn back as
 * tile quads under a fractional zoom matches the same content drawn live, seams included, and the
 * renderer's byte count follows what it holds.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD, type GlMat3 } from '@weasel-js/geom';
import { WeaselRenderer } from '@weasel-js/renderer';
import type { DrawCommand } from '../DrawCommand';
import type { TileTexture } from './TileTextures';

const W = 96;
const H = 64;
/** Texels a side of a tile's own area; each is baked with a one-texel gutter past it. */
const TILE = 32;
const GUTTER = 1;

const open: WeaselRenderer[] = [];
afterEach(() => {
  for (const r of open.splice(0)) r.dispose();
});

function rendererOf(): { r: WeaselRenderer; gl: WebGL2RenderingContext } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  open.push(r);
  return { r, gl };
}

/** Soft content crossing every tile edge: rects at fractional offsets, a circle and a stroke. */
function world(): DrawCommand[] {
  const out: DrawCommand[] = [{ kind: 'path', path: { kind: 'rect', x: -10, y: -10, width: 200, height: 200 }, fill: { paint: { color: '#204060' } } }];
  for (let i = 0; i < 12; i++) {
    out.push({
      kind: 'path', path: { kind: 'rect', x: i * 6.3 + 0.4, y: (i % 5) * 7.1 + 0.2, width: 9.5, height: 5.3 },
      fill: { paint: { color: `rgba(${(i * 50) & 255}, 200, ${(i * 90) & 255}, 0.8)` } },
    });
  }
  out.push(
    { kind: 'path', path: pathFromD('M30 24 A11 11 0 1 1 29.99 24 Z'), fill: { paint: { color: '#ffcc00' } } },
    { kind: 'path', path: pathFromD('M-5 40 C 20 -5, 40 70, 80 8'), stroke: { paint: { color: '#ff3366' }, width: 1.3 } },
  );
  return out;
}

function read(gl: WebGL2RenderingContext, r: WeaselRenderer, commands: DrawCommand[], view: GlMat3): Uint8Array {
  r.render(commands, view);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

/** Bake the tile `x, y` at level `z` of a pyramid `TILE` texels a side. */
function bake(r: WeaselRenderer, z: number, x: number, y: number): TileTexture {
  const k = 2 ** z, side = TILE / k;
  const toTexels = mat3.translated(mat3.scaled(mat3.identity(), k, k), -x * side + GUTTER / k, -y * side + GUTTER / k);
  return r.tiles.bake([{ kind: 'group', transform: toTexels, children: world() }], TILE + 2 * GUTTER)!;
}

/** The tile quads covering world `[0, 0]–[cols, rows]` tiles at level `z`. */
function quads(tiles: Map<string, TileTexture>, z: number, cols: number, rows: number): DrawCommand[] {
  const side = TILE / 2 ** z;
  const out: DrawCommand[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      out.push({
        kind: 'tile', tile: tiles.get(`${x}/${y}`)!, x: x * side, y: y * side, width: side, height: side,
        source: { x: GUTTER, y: GUTTER, width: TILE, height: TILE },
      });
    }
  }
  return out;
}

describe('baked tiles', () => {
  it('drawn under a fractional zoom match one texture of the whole area, seams included, and the content live', () => {
    const { r, gl } = rendererOf();
    // 1.37 CSS px a unit: level 1, two texels a unit, each covering 0.69 device pixels.
    const scale = 1.37;
    const view = mat3.translated(mat3.scaled(mat3.identity(), scale, scale), 0.3, 0.6);
    const z = 1, cols = 5, rows = 4, k = 2 ** z;
    const tiles = new Map<string, TileTexture>();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) tiles.set(`${x}/${y}`, bake(r, z, x, y));
    const tiled = read(gl, r, [{ kind: 'group', transform: view, children: quads(tiles, z, cols, rows) }], view);
    // The same texels in one texture: any difference is a seam's.
    const side = cols * TILE;
    const whole = r.tiles.bake([{ kind: 'group', transform: mat3.translated(mat3.scaled(mat3.identity(), k, k), GUTTER / k, GUTTER / k), children: world() }], side + 2 * GUTTER)!;
    const one = read(gl, r, [{ kind: 'group', transform: view, children: [{
      kind: 'tile', tile: whole, x: 0, y: 0, width: side / k, height: side / k, source: { x: GUTTER, y: GUTTER, width: side, height: side },
    }] }], view);
    const live = read(gl, r, [{ kind: 'group', transform: view, children: world() }], view);
    const stats = (a: Uint8Array, b: Uint8Array) => {
      let sum = 0, max = 0;
      for (let i = 0; i < a.length; i += 4) {
        let d = 0;
        for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c]! - b[i + c]!));
        sum += d;
        max = Math.max(max, d);
      }
      return { mean: sum / (W * H), max };
    };
    const seams = stats(tiled, one);
    expect(seams.max, `tiles against one texture: ${JSON.stringify(seams)}`).toBeLessThanOrEqual(2);
    // Resampled, not exact: a texel covering 0.69 device pixels softens an edge by a few levels.
    const resampled = stats(tiled, live);
    expect(resampled.mean, JSON.stringify(resampled)).toBeLessThan(6);
  });

  it('reports the bytes it holds, and frees a tile into its pool', () => {
    const { r } = rendererOf();
    const size = TILE + 2 * GUTTER;
    const a = bake(r, 0, 0, 0), b = bake(r, 0, 1, 0);
    expect(r.tiles.count).toBe(2);
    const held = 2 * size * size * 4;
    expect(r.tiles.bytes).toBeGreaterThanOrEqual(held);
    r.tiles.release(a);
    expect(r.tiles.count).toBe(1);
    r.tiles.idle();
    // The released texture waits in the pool for the next bake, which reuses it.
    expect(r.tiles.bytes).toBe(held);
    bake(r, 0, 2, 0);
    r.tiles.idle();
    expect(r.tiles.bytes).toBe(held);
    r.tiles.release(b);
  });

  it('baked over several calls, each clipped to its part, matches the tile baked at once', () => {
    const { r, gl } = rendererOf();
    const size = TILE + 2 * GUTTER;
    const k = 2, toTexels = mat3.translated(mat3.scaled(mat3.identity(), k, k), GUTTER / k, GUTTER / k);
    const whole = r.tiles.bake([{ kind: 'group', transform: toTexels, children: world() }], size)!;
    const parts = r.tiles.begin(size)!;
    // An uneven split, so no edge falls on the middle.
    for (const [x0, y0, x1, y1] of [[0, 0, 13, 21], [13, 0, size, 21], [0, 21, 13, size], [13, 21, size, size]] as const) {
      parts.draw([{ kind: 'group', clip: pathFromD(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`), children: [{ kind: 'group', transform: toTexels, children: world() }] }]);
    }
    const split = parts.finish()!;
    const at = mat3.identity();
    const show = (tile: TileTexture) => read(gl, r, [{ kind: 'tile', tile, x: 0, y: 0, width: size, height: size, source: { x: 0, y: 0, width: size, height: size } }], at);
    const a = show(whole), b = show(split);
    let max = 0;
    for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]! - b[i]!));
    expect(max).toBeLessThanOrEqual(1);
    const before = r.tiles.bytes;
    r.tiles.begin(size)!.cancel();
    expect(r.tiles.bytes).toBe(before);
  });
});
