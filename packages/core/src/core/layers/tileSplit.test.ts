import { describe, expect, it } from 'vitest';
import type { DrawCommand, TileTexture } from '@weasel-js/renderer';
import { createPlaneScheme } from '@weasel-js/tiles';
import type { View } from 'core/viewport/view';
import type { LayerDims } from './dims';
import { createTileBakes, type TileBaker } from './tileSplit';

const TILE_PX = 254;
const SIZE = TILE_PX + 2;

/** A clock the draws move: each costs `msPerTexel` for every texel it covers. */
function rig(msPerTexel: number) {
  let now = 0;
  const parts: number[][] = [];
  const whole: number[] = [];
  let cancels = 0;
  const baker: TileBaker = {
    generation: 0, bytes: 0, idle: () => {}, release: () => {},
    bake: (_c, size) => {
      whole.push(size);
      return { kind: 'tile-texture', size };
    },
    begin: (size) => ({
      size, draw: () => true, cancel: () => { cancels++; },
      finish: (): TileTexture => ({ kind: 'tile-texture', size }),
    }),
  };
  const draw = (_v: View, dims: LayerDims): DrawCommand[] => {
    now += msPerTexel * dims.width * dims.height;
    parts.push([dims.width, dims.height]);
    return [];
  };
  const scheme = createPlaneScheme(TILE_PX);
  const bakes = createTileBakes(baker, scheme, TILE_PX, () => now);
  return { bakes, draw, parts, whole, cancels: () => cancels, at: () => now, step: (ms: number) => { now += ms; } };
}

describe('tile bakes under a frame budget', () => {
  it('bake a tile costing four frames in parts, none of them past the budget by much', () => {
    // 40 ms for the whole tile against 10 a frame.
    const r = rig(40 / (SIZE * SIZE));
    const key = { z: 0, x: 0, y: 0 };
    let tile: TileTexture | null = null;
    let frames = 0;
    while (!tile && frames < 20) {
      const t0 = r.at();
      tile = r.bakes.bake(key, r.draw, t0 + 10);
      expect(r.at() - t0).toBeLessThan(10 + 40 / 4);
      if (!tile) expect(r.bakes.inFlight).toBe(true);
      frames++;
    }
    expect(tile).not.toBeNull();
    expect(frames).toBeGreaterThanOrEqual(4);
    expect(r.bakes.inFlight).toBe(false);
    // Every texel was drawn once.
    expect(r.parts.reduce((a, [w, h]) => a + w! * h!, 0)).toBe(SIZE * SIZE);
    expect(r.whole).toEqual([]);
  });

  it('bake a tile whole once its level is known to fit', () => {
    const r = rig(1 / (SIZE * SIZE));
    expect(r.bakes.bake({ z: 0, x: 0, y: 0 }, r.draw, 10)).not.toBeNull();
    expect(r.bakes.bake({ z: 0, x: 1, y: 0 }, r.draw, r.at() + 10)).not.toBeNull();
    expect(r.whole).toEqual([SIZE]);
  });

  it('throw a part-baked tile away when damage falls on it, and start it over', () => {
    const r = rig(40 / (SIZE * SIZE));
    const key = { z: 0, x: 0, y: 0 };
    expect(r.bakes.bake(key, r.draw, 10)).toBeNull();
    r.bakes.damaged([[1000, 1000, 1010, 1010]]);
    expect(r.cancels()).toBe(0);
    r.bakes.damaged([[10, 10, 20, 20]]);
    expect(r.cancels()).toBe(1);
    expect(r.bakes.inFlight).toBe(false);
  });

  it('give up a part-baked tile for another', () => {
    const r = rig(40 / (SIZE * SIZE));
    expect(r.bakes.bake({ z: 0, x: 0, y: 0 }, r.draw, 10)).toBeNull();
    r.step(1);
    expect(r.bakes.bake({ z: 0, x: 1, y: 0 }, r.draw, r.at() + 10)).toBeNull();
    expect(r.cancels()).toBe(1);
  });

  it('guess a level it has not baked from the nearest one it has, four times the cost a level coarser', () => {
    // 40 ms a tile at level 1 is 160 at level 0: a level-0 tile goes in parts from its first call.
    const r = rig(40 / (SIZE * SIZE));
    let t: TileTexture | null = null;
    for (let f = 0; f < 20 && !t; f++) t = r.bakes.bake({ z: 1, x: 0, y: 0 }, r.draw, r.at() + 50);
    expect(t).not.toBeNull();
    r.parts.length = 0;
    const t0 = r.at();
    expect(r.bakes.bake({ z: 0, x: 0, y: 0 }, r.draw, t0 + 10)).toBeNull();
    expect(r.parts.length).toBeGreaterThan(0);
  });
});
