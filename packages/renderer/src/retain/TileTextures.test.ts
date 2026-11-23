import { describe, expect, it } from 'vitest';
import { createGLRecorder } from '../testing/glRecorder';
import { webglDevice } from '../gpu/webgl/WebGLDevice';
import { TileTextures } from './TileTextures';

describe('TileTextures', () => {
  it('pools a bounded number of freed textures across every size, keeping the latest', () => {
    const tiles = new TileTextures(webglDevice(createGLRecorder().gl));
    const sizes: number[] = [];
    for (let size = 1; size <= 40; size++) {
      tiles.release(tiles.keep(size, tiles.scratchFor(size)));
      sizes.push(size);
    }
    tiles.dropScratch();
    const latest = sizes.slice(-16).reduce((n, s) => n + s * s * 4, 0);
    expect(tiles.bytes).toBe(latest);
  });

  it('still pools many textures of one size', () => {
    const tiles = new TileTextures(webglDevice(createGLRecorder().gl));
    const held = Array.from({ length: 20 }, () => tiles.keep(8, tiles.scratchFor(8)));
    tiles.dropScratch();
    for (const t of held) tiles.release(t);
    expect(tiles.bytes).toBe(16 * 8 * 8 * 4);
  });
});
