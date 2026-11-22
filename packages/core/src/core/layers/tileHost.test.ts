import { describe, expect, it } from 'vitest';
import type { DrawCommand, TileTexture } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { drawLayers, type RenderLayer } from './render';
import { createTileHost, type TileBaker } from './tileHost';
import type { TileOptions } from './tiles';

const DIMS = { width: 400, height: 300, dpr: 1 };
const RECT: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 10, y: 10, width: 100, height: 100 }, fill: { paint: { color: 'red' } } };

/** A baker that hands out fake textures, counting what it holds. */
function fakeBaker(): TileBaker & { held: Set<TileTexture>; baked: number } {
  const held = new Set<TileTexture>();
  const b = {
    held, baked: 0, generation: 0,
    get bytes() { return held.size; },
    bake: (_cmds: readonly DrawCommand[], size: number) => {
      const t: TileTexture = { kind: 'tile-texture', size };
      held.add(t);
      b.baked++;
      return t;
    },
    begin: (size: number) => ({
      size, draw: () => true, finish: () => b.bake([], size), cancel: () => {},
    }),
    release: (t: TileTexture) => { held.delete(t); },
    idle: () => {},
  };
  return b;
}

function tiledLayer(tiles: TileOptions, draws: string[], deps?: () => readonly unknown[]): RenderLayer<null> {
  return {
    id: 'bg', label: 'bg', tiles,
    ...(deps ? { deps } : {}),
    draw: (_d, _v, dims) => {
      draws.push(dims.bake ? 'bake' : 'live');
      return [RECT];
    },
  };
}

const frame = (layer: RenderLayer<null>, host: ReturnType<typeof createTileHost>, view: View) =>
  drawLayers([layer], null, {}, undefined, view, DIMS, undefined, undefined, undefined, undefined, false, host);

const kinds = (cmds: DrawCommand[]): string[] => JSON.stringify(cmds).match(/"kind":"(tile|path)"/g) ?? [];

describe('a tiled layer', () => {
  it('zooms from fit-all to 64x and back without drawing the layer live once the floor is in', () => {
    const baker = fakeBaker();
    const host = createTileHost(baker, { ms: Infinity, tiles: 8 }, () => 0);
    const draws: string[] = [];
    const layer = tiledLayer({ tilePx: 64, fadeMs: 0, bounds: () => [0, 0, 2000, 2000] }, draws);
    for (let f = 0; f < 120; f++) {
      const s = 0.2 * 2 ** (6 * (f < 60 ? f / 59 : (119 - f) / 59));
      const out = frame(layer, host, { x: 900 - 200 / s, y: 900 - 150 / s, scale: { x: s, y: s } });
      expect(kinds(out).every((k) => k === '"kind":"tile"')).toBe(true);
      expect(host.stats().liveDraws).toBe(0);
    }
    expect(draws.every((d) => d === 'bake')).toBe(true);
    expect(baker.baked).toBeGreaterThan(0);
  });

  it('draws live past maxLevel', () => {
    const host = createTileHost(fakeBaker(), {}, () => 0);
    const draws: string[] = [];
    const out = frame(tiledLayer({ tilePx: 64, maxLevel: 1, bounds: () => [0, 0, 100, 100] }, draws), host, { x: 0, y: 0, scale: { x: 8, y: 8 } });
    expect(draws).toEqual(['live']);
    expect(kinds(out)).toEqual(['"kind":"path"']);
  });

  it('stales every tile when its deps move, and bakes them again', () => {
    const baker = fakeBaker();
    const host = createTileHost(baker, { ms: Infinity, tiles: 100 }, () => 0);
    let version = 0;
    const layer = tiledLayer({ tilePx: 64, fadeMs: 0, bounds: () => [0, 0, 500, 500] }, [], () => [version]);
    const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    for (let f = 0; f < 5; f++) frame(layer, host, view);
    const before = baker.baked;
    frame(layer, host, view);
    expect(baker.baked).toBe(before);
    version++;
    frame(layer, host, view);
    frame(layer, host, view);
    frame(layer, host, view);
    expect(baker.baked).toBeGreaterThan(before);
  });

  it('frees its tiles once it is no longer drawn tiled', () => {
    const baker = fakeBaker();
    const host = createTileHost(baker, { ms: Infinity, tiles: 100 }, () => 0);
    frame(tiledLayer({ tilePx: 64, bounds: () => [0, 0, 500, 500] }, []), host, { x: 0, y: 0, scale: { x: 1, y: 1 } });
    expect(baker.held.size).toBeGreaterThan(0);
    drawLayers([], null, {}, undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS, undefined, undefined, undefined, undefined, false, host);
    expect(baker.held.size).toBe(0);
  });

  it('refuses a screen-space layer', () => {
    const errors: string[] = [];
    const layer: RenderLayer<null> = { ...tiledLayer({}, []), space: 'screen' };
    drawLayers([layer], null, {}, undefined, undefined, DIMS, undefined, (f) => errors.push(f.layerId), undefined, undefined, false,
      createTileHost(fakeBaker()));
    expect(errors).toEqual(['bg']);
  });
});
