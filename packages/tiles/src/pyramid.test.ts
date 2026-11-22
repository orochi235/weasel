import { describe, expect, it } from 'vitest';
import { createPlaneScheme, planeFloor, type PlaneTileKey, type PlaneTileView } from './scheme';
import { TilePyramid, type TileBudget } from './pyramid';

const TILE = 256;
const TILE_BYTES = TILE * TILE * 4;
const scheme = createPlaneScheme(TILE);
const BOUNDS = [0, 0, 4000, 3000];

interface Fake { id: string; freed: boolean }

/** A pyramid over a fake baker that records what it made and freed. */
function setup(maxBytes = 64 * TILE_BYTES) {
  const made: Fake[] = [];
  const pyramid = new TilePyramid<PlaneTileKey, PlaneTileView, Fake>({
    scheme, maxBytes, minCount: 16, bytesPerTile: TILE_BYTES, fadeMs: 0,
    bytesOf: () => TILE_BYTES,
    release: (p) => { p.freed = true; },
    floor: () => planeFloor(scheme, TILE, BOUNDS),
  });
  const bake = (k: PlaneTileKey): Fake => {
    const f = { id: scheme.idOf(k), freed: false };
    made.push(f);
    return f;
  };
  return { pyramid, made, bake };
}

const t = 0;
const budget: TileBudget = { ms: Infinity, tiles: 6, clock: () => t };

/** A view of `w × h` CSS pixels at `scale`, its top-left at world `x, y`. */
function view(x: number, y: number, scale: number, w = 800, h = 600): PlaneTileView {
  return { box: [x, y, x + w / scale, y + h / scale], pxPerUnit: scale * 2 };
}

/** A deterministic generator, so a failure replays. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('TilePyramid', () => {
  it('keeps count and bytes in bound and the floor in, through a long random walk', () => {
    const { pyramid, bake } = setup();
    const floorIds = planeFloor(scheme, TILE, BOUNDS).map((k) => scheme.idOf(k));
    const r = rng(7);
    let x = 0, y = 0, scale = 0.2;
    for (let f = 0; f < 2000; f++) {
      x += (r() - 0.5) * 400 / scale;
      y += (r() - 0.5) * 300 / scale;
      scale = Math.min(64, Math.max(0.05, scale * 2 ** ((r() - 0.5) * 0.6)));
      if (r() < 0.02) pyramid.dirty([x, y, x + 100, y + 100]);
      const frame = pyramid.run(view(x, y, scale), f * 16, bake, budget);
      const onScreen = scheme.wanted(view(x, y, scale), frame.level).filter((w) => !w.ring).length;
      const ring = scheme.wanted(view(x, y, scale), frame.level).filter((w) => w.ring).length;
      expect(pyramid.cache.bytes).toBeLessThanOrEqual(64 * TILE_BYTES);
      expect(pyramid.cache.count).toBeLessThanOrEqual(Math.max(16, 2 * (onScreen + ring + floorIds.length)));
      // Once baked, the floor stays.
      if (f > 10) for (const id of floorIds) expect(pyramid.cache.get(id)).toBeDefined();
    }
  });

  it('frees every payload it drops, and nothing it still holds', () => {
    const { pyramid, made, bake } = setup(20 * TILE_BYTES);
    for (let f = 0; f < 300; f++) pyramid.run(view(f * 37, f * 11, 1 + (f % 7)), f, bake, budget);
    const held = new Set([...pyramid.cache.tiles()].map((tile) => tile.payload));
    for (const p of made) expect(p.freed).toBe(!held.has(p));
    pyramid.clear();
    expect(made.every((p) => p.freed)).toBe(true);
  });

  it('bakes the floor first, then the tiles on screen, under the tile budget', () => {
    const { pyramid, made, bake } = setup();
    const first = pyramid.run(view(0, 0, 1), 0, bake, { ...budget, tiles: 2 });
    expect(first.baked).toBe(2);
    const floor = planeFloor(scheme, TILE, BOUNDS).map((k) => scheme.idOf(k));
    expect(floor).toHaveLength(1);
    expect(made[0]!.id).toBe(floor[0]);
    // Then the on-screen tile nearest the view's center.
    expect(made[1]!.id.startsWith(`${first.level}/`)).toBe(true);
    expect(first.pending).toBeGreaterThan(0);
  });

  it('stands a coarser tile in for one not yet baked, sampling its part of it', () => {
    const { pyramid, bake } = setup();
    // Everything at level 0 baked: then zoom in one level and bake nothing.
    for (let f = 0; f < 20; f++) pyramid.run(view(0, 0, 0.5, 400, 300), f, bake, { ...budget, tiles: 100 });
    const frame = pyramid.run(view(0, 0, 1, 400, 300), 20, () => null, { ...budget, tiles: 0 });
    expect(frame.level).toBe(1);
    const standIn = frame.draws.find((d) => d.at.z === 1 && d.tile.key.z === 0);
    expect(standIn).toBeDefined();
    expect(Array.from(standIn!.source)).toEqual([
      (standIn!.at.x % 2) / 2, (standIn!.at.y % 2) / 2, (standIn!.at.x % 2 + 1) / 2, (standIn!.at.y % 2 + 1) / 2,
    ]);
  });

  it('draws finer tiles over the coarse stand-in after a zoom out', () => {
    const { pyramid, bake } = setup();
    for (let f = 0; f < 20; f++) pyramid.run(view(0, 0, 2, 400, 300), f, bake, { ...budget, tiles: 100 });
    const frame = pyramid.run(view(0, 0, 1, 400, 300), 20, () => null, { ...budget, tiles: 0 });
    expect(frame.level).toBe(1);
    expect(frame.draws.some((d) => d.tile.key.z === 2)).toBe(true);
  });

  it('marks stale only held tiles a box meets, and rebakes them once the damage holds a frame', () => {
    const { pyramid, made, bake } = setup();
    for (let f = 0; f < 20; f++) pyramid.run(view(0, 0, 1), f, bake, { ...budget, tiles: 100 });
    const before = made.length;
    expect(pyramid.dirty([10, 10, 20, 20])).toBeGreaterThan(0);
    const now = pyramid.run(view(0, 0, 1), 20, bake, { ...budget, tiles: 100 });
    expect(now.stale.length).toBeGreaterThan(0);
    expect(made.length).toBe(before);
    pyramid.run(view(0, 0, 1), 21, bake, { ...budget, tiles: 100 });
    expect(made.length).toBeGreaterThan(before);
  });

  it('holds its level through a zoom parked on a boundary', () => {
    const { pyramid, bake } = setup();
    const levels = new Set<number>();
    for (let f = 0; f < 100; f++) levels.add(pyramid.run(view(0, 0, 1 * (f % 2 ? 1.02 : 0.98)), f, bake, budget).level);
    expect(levels.size).toBe(1);
  });

  it('fades a new tile in over its stand-in, and asks for frames while it does', () => {
    const made: unknown[] = [];
    const pyramid = new TilePyramid<PlaneTileKey, PlaneTileView, object>({
      scheme, bytesOf: () => 1, release: () => {}, floor: () => planeFloor(scheme, TILE, BOUNDS), fadeMs: 100,
    });
    const bake = () => { const p = {}; made.push(p); return p; };
    const a = pyramid.run(view(0, 0, 1), 0, bake, { ...budget, tiles: 100 });
    expect(a.fading).toBe(true);
    expect(a.draws.some((d) => d.alpha > 0 && d.alpha < 1) || a.draws.every((d) => d.alpha === 0 || d.alpha === 1)).toBe(true);
    const b = pyramid.run(view(0, 0, 1), 200, bake, { ...budget, tiles: 100 });
    expect(b.fading).toBe(false);
  });

  it('draws live past maxLevel', () => {
    const pyramid = new TilePyramid<PlaneTileKey, PlaneTileView, object>({
      scheme, bytesOf: () => 1, release: () => {}, floor: () => [], maxLevel: 2,
    });
    expect(pyramid.run(view(0, 0, 16), 0, () => ({}), budget).live).toBe(true);
  });
});

describe('TilePyramid frames', () => {
  it('lists a stale stand-in once, however many spots it covers', () => {
    const { pyramid, bake } = setup();
    for (let f = 0; f < 20; f++) pyramid.run(view(0, 0, 0.5, 400, 300), f, bake, { ...budget, tiles: 100 });
    pyramid.dirtyAll();
    const frame = pyramid.run(view(0, 0, 1, 400, 300), 20, () => null, { ...budget, tiles: 0 });
    const ids = frame.stale.map((k) => scheme.idOf(k));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TilePyramid pending', () => {
  it('counts stale tiles waiting out their hold, so the caller asks for the frame that rebakes them', () => {
    const { pyramid, made, bake } = setup();
    let f = 0;
    for (; f < 20; f++) pyramid.run(view(0, 0, 1), f, bake, { ...budget, tiles: 100 });
    pyramid.dirtyAll();
    const held = pyramid.run(view(0, 0, 1), f++, bake, { ...budget, tiles: 100 });
    expect(held.pending).toBeGreaterThan(0);
    const before = made.length;
    const rebaked = pyramid.run(view(0, 0, 1), f++, bake, { ...budget, tiles: 100 });
    expect(made.length).toBeGreaterThan(before);
    expect(rebaked.pending).toBe(0);
  });
});
