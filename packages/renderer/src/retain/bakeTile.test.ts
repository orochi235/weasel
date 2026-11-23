import { describe, expect, it } from 'vitest';
import { createGLRecorder } from '../testing/glRecorder';
import { webglDevice } from '../gpu/webgl/WebGLDevice';
import { TileTextures } from './TileTextures';
import { BakedTiles } from './bakeTile';

describe('BakedTiles.begin', () => {
  it('frees its own scratch buffer when the opening clear throws', () => {
    const gpu = webglDevice(createGLRecorder().gl);
    const textures = new TileTextures(gpu);
    const noop = (): void => {};
    const tiles = new BakedTiles(textures, gpu, () => true, noop, () => { throw new Error('lost'); }, noop);
    expect(() => tiles.begin(8)).toThrow('lost');
    expect(tiles.bytes).toBe(0);
  });
});
