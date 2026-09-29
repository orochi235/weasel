import { describe, it, expect, vi } from 'vitest';
import {
  MeshBakeCache, meshBakeSize, MESH_BAKE_MAX, MESH_BAKE_MIN,
} from './bakeCache';
import { MESH_BAKE_SIZE } from './bake';

describe('meshBakeSize', () => {
  it('rounds the drawn size up to a power of two', () => {
    expect(meshBakeSize(300, 16384)).toBe(512);
    expect(meshBakeSize(512, 16384)).toBe(512);
    expect(meshBakeSize(513, 16384)).toBe(1024);
  });

  it('holds one bucket across a zoom inside it, so zooming does not rebake', () => {
    const sizes = new Set([520, 600, 700, 800, 900, 1000, 1024].map((px) => meshBakeSize(px, 16384)));
    expect([...sizes]).toEqual([1024]);
  });

  it('never goes below the floor, however small the paint draws', () => {
    expect(meshBakeSize(3, 16384)).toBe(MESH_BAKE_MIN);
    expect(meshBakeSize(0, 16384)).toBe(MESH_BAKE_MIN);
  });

  it('stops at the texture budget, however large the paint draws', () => {
    expect(meshBakeSize(100_000, 16384)).toBe(MESH_BAKE_MAX);
  });

  it('stops at the context MAX_TEXTURE_SIZE when that is smaller, as a power of two', () => {
    expect(meshBakeSize(100_000, 1024)).toBe(1024);
    expect(meshBakeSize(100_000, 1500)).toBe(1024);
  });

  it('falls back to the default size when the drawn size cannot be measured', () => {
    expect(meshBakeSize(Number.NaN, 16384)).toBe(MESH_BAKE_SIZE);
    expect(meshBakeSize(Infinity, 16384)).toBe(MESH_BAKE_MAX);
  });
});

describe('MeshBakeCache', () => {
  const bytes = (size: number) => size * size * 4;

  function cache(budget: number, maxEntries = 100) {
    const freed: string[] = [];
    const c = new MeshBakeCache<string>((v) => freed.push(v), budget, maxEntries);
    return { c, freed };
  }

  it('keys by paint and bucket, so one paint holds one bake per size', () => {
    const { c } = cache(bytes(1024) * 4);
    const paint = {};
    c.set(paint, 256, 'a256');
    c.set(paint, 1024, 'a1024');
    expect(c.get(paint, 256)).toBe('a256');
    expect(c.get(paint, 1024)).toBe('a1024');
    expect(c.get(paint, 512)).toBeUndefined();
    expect(c.get({}, 256)).toBeUndefined();
  });

  it('evicts the least recently used bake once the byte budget is exceeded, and frees it', () => {
    const { c, freed } = cache(bytes(256) * 2);
    const a = {}; const b = {}; const d = {};
    c.set(a, 256, 'a');
    c.set(b, 256, 'b');
    // Touch `a`, so `b` is the oldest.
    expect(c.get(a, 256)).toBe('a');
    c.set(d, 256, 'd');
    expect(freed).toEqual(['b']);
    expect(c.get(b, 256)).toBeUndefined();
    expect(c.get(a, 256)).toBe('a');
    expect(c.get(d, 256)).toBe('d');
    expect(c.bytes).toBe(bytes(256) * 2);
  });

  it('bounds the entry count as well as the bytes', () => {
    const { c, freed } = cache(Infinity, 3);
    for (let i = 0; i < 5; i++) c.set({}, MESH_BAKE_MIN, `p${i}`);
    expect(c.size).toBe(3);
    expect(freed).toEqual(['p0', 'p1']);
  });

  it('frees the value it replaces', () => {
    const { c, freed } = cache(Infinity);
    const paint = {};
    c.set(paint, 256, 'old');
    c.set(paint, 256, 'new');
    expect(freed).toEqual(['old']);
    expect(c.size).toBe(1);
  });

  it('frees everything on clear and forgets it', () => {
    const free = vi.fn();
    const c = new MeshBakeCache<string>(free, Infinity, 100);
    const paint = {};
    c.set(paint, 256, 'a');
    c.set(paint, 512, 'b');
    c.clear();
    expect(free.mock.calls.map(([v]) => v).sort()).toEqual(['a', 'b']);
    expect(c.get(paint, 256)).toBeUndefined();
    expect(c.size).toBe(0);
    expect(c.bytes).toBe(0);
  });
});
