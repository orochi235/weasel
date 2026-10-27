import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PATH_M as M, PATH_L as L, PATH_Z as Z, type PolygonPath } from '@weasel-js/geom';
import type { ImagePatternPaint } from '@weasel-js/paint';
import { makeGLRecorder } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import { _resetTextureRegistryForTests, getTexture } from '../textures/registerTexture';
import { __setImageLoaderForTests, _resetImageCacheForTests, getImageBitmap, releaseImage } from '../images/imageCache';
import { resolveFillPattern } from './resolveSpec';

const SRC = 'data:image/png;base64,AAAA';

function fakeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('an image pattern paint', () => {
  let bitmaps: ImageBitmap[];

  beforeEach(() => {
    _resetImageCacheForTests();
    _resetTextureRegistryForTests();
    bitmaps = [];
    __setImageLoaderForTests(async () => {
      const b = fakeBitmap(8, 4);
      bitmaps.push(b);
      return b;
    });
  });
  afterEach(() => {
    _resetImageCacheForTests();
    _resetTextureRegistryForTests();
  });

  it('resolves to a texture paint at once, keeping its extent and placement', () => {
    const paint: ImagePatternPaint = {
      kind: 'image', src: SRC, width: 30, height: 15, units: 'world', origin: { x: 2, y: 3 }, opacity: 0.5,
    };
    expect(resolveFillPattern(paint)).toEqual({
      kind: 'texture', texture: { id: `image:${SRC}` }, width: 30, height: 15,
      units: 'world', origin: { x: 2, y: 3 }, opacity: 0.5,
    });
  });

  it('gives two paints of one picture one texture id', () => {
    const a = resolveFillPattern({ kind: 'image', src: SRC });
    const b = resolveFillPattern({ kind: 'image', src: SRC, width: 4 });
    expect((a as { texture: { id: string } }).texture.id).toBe((b as { texture: { id: string } }).texture.id);
  });

  it('has no texture until the picture decodes, then the decoded bitmap', async () => {
    const id = `image:${SRC}`;
    expect(getTexture(id)).toBeNull();
    await settle();
    expect(getTexture(id)?.source).toBe(bitmaps[0]);
  });

  it('follows the image cache when it drops the bitmap and loads it again', async () => {
    const id = `image:${SRC}`;
    getTexture(id);
    await settle();
    expect(getTexture(id)?.source).toBe(bitmaps[0]);
    releaseImage(SRC);
    // The cache closed that bitmap; the registry must not hand it out again.
    expect(getTexture(id)).toBeNull();
    await settle();
    expect(getTexture(id)?.source).toBe(bitmaps[1]);
  });
});

const SQUARE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([M, L, L, L, Z]),
  coords: new Float32Array([0, 0, 40, 0, 40, 40, 0, 40]),
  fillRule: 'evenodd',
};

function draw(paint: unknown) {
  const rec = makeGLRecorder();
  const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
  rec.reset();
  r.render([{ kind: 'path', path: SQUARE, fill: { paint } } as DrawCommand]);
  return { rec, r };
}

describe('drawing an image pattern', () => {
  beforeEach(() => {
    _resetImageCacheForTests();
    _resetTextureRegistryForTests();
    __setImageLoaderForTests(async () => fakeBitmap(8, 4));
  });
  afterEach(() => {
    _resetImageCacheForTests();
    _resetTextureRegistryForTests();
    vi.restoreAllMocks();
  });

  it('draws nothing and says nothing while the picture loads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const paint = resolveFillPattern({ kind: 'image', src: SRC });
    const { rec } = draw(paint);
    expect(rec.calls.some((c) => c.name === 'texImage2D')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('tiles at the extent the paint names, not the bitmap size', async () => {
    const paint = resolveFillPattern({ kind: 'image', src: SRC, width: 30, height: 15 });
    draw(paint);
    await settle();
    const { rec, r } = draw(paint);
    const prog = r._patternFill();
    const loc = prog.uniform('u_tileSize');
    const sent = rec.calls.filter((c) => c.name === 'uniform2f' && c.args[0] === loc).at(-1);
    expect(sent?.args.slice(1)).toEqual([30, 15]);
  });

  it('tiles at the bitmap size when the paint names no extent', async () => {
    const paint = resolveFillPattern({ kind: 'image', src: SRC });
    draw(paint);
    await settle();
    const { rec, r } = draw(paint);
    const prog = r._patternFill();
    const loc = prog.uniform('u_tileSize');
    const sent = rec.calls.filter((c) => c.name === 'uniform2f' && c.args[0] === loc).at(-1);
    expect(sent?.args.slice(1)).toEqual([8, 4]);
  });

  it('tiles an SVG at its natural size after an image node re-rasterizes it larger', async () => {
    const SVG = 'data:image/svg+xml,%3Csvg%3E';
    __setImageLoaderForTests(async (_src, size) => fakeBitmap(size?.width ?? 8, size?.height ?? 4));
    const paint = resolveFillPattern({ kind: 'image', src: SVG });
    draw(paint);
    await settle();
    // What an image node drawing the same picture at 4x asks of the cache.
    getImageBitmap(SVG, { width: 32, height: 16 });
    await settle();
    expect(getImageBitmap(SVG)?.width).toBe(32);
    const { rec, r } = draw(paint);
    const loc = r._patternFill().uniform('u_tileSize');
    const sent = rec.calls.filter((c) => c.name === 'uniform2f' && c.args[0] === loc).at(-1);
    expect(sent?.args.slice(1)).toEqual([8, 4]);
  });
});
