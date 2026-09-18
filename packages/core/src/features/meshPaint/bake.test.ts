import { describe, it, expect } from 'vitest';
import { bakeMesh, meshBounds, MESH_BAKE_SIZE } from './bake';
import type { MeshPatch, MeshPoint } from './surface';

function squarePatch(
  box = { x: 0, y: 0, w: 1, h: 1 },
  colors: MeshPatch['colors'] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
): MeshPatch {
  const corners: MeshPoint[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  const points: MeshPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    points.push(
      a,
      { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
      { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
    );
  }
  return { points, colors };
}

/** The texel at a fraction across the bake, as 0..255 RGBA. */
function texel(baked: NonNullable<ReturnType<typeof bakeMesh>>, fx: number, fy: number): number[] {
  const x = Math.min(baked.size - 1, Math.floor(fx * baked.size));
  const y = Math.min(baked.size - 1, Math.floor(fy * baked.size));
  const k = (y * baked.size + x) * 4;
  return Array.from(baked.pixels.slice(k, k + 4));
}

describe('meshBounds', () => {
  it('unions the patches', () => {
    const box = meshBounds([
      squarePatch({ x: 0, y: 0, w: 1, h: 1 }),
      squarePatch({ x: 2, y: -1, w: 1, h: 1 }),
    ]);
    expect(box).toMatchObject({
      x: expect.closeTo(0, 6), y: expect.closeTo(-1, 6),
      width: expect.closeTo(3, 6), height: expect.closeTo(2, 6),
    });
  });

  it('has nothing to bound when no patch is drawable', () => {
    expect(meshBounds([])).toBeNull();
    expect(meshBounds([{ points: [], colors: ['#000', '#000', '#000', '#000'] }])).toBeNull();
  });
});

describe('bakeMesh', () => {
  it('declines an empty mesh rather than baking a blank square', () => {
    expect(bakeMesh([])).toBeNull();
  });

  it('bakes a square bitmap at the documented size', () => {
    const baked = bakeMesh([squarePatch()])!;
    expect(baked.size).toBe(MESH_BAKE_SIZE);
    expect(baked.pixels.length).toBe(MESH_BAKE_SIZE * MESH_BAKE_SIZE * 4);
  });

  it('puts each corner color in its own corner texel', () => {
    const baked = bakeMesh([squarePatch()])!;
    expect(texel(baked, 0, 0)).toEqual([255, 0, 0, 255]);            // corner 0
    expect(texel(baked, 1, 0)).toEqual([0, 255, 0, 255]);            // corner 1
    expect(texel(baked, 1, 1)).toEqual([0, 0, 255, 255]);            // corner 2
    expect(texel(baked, 0, 1)).toEqual([255, 255, 0, 255]);          // corner 3
  });

  it('covers the whole box with opaque texels for a square patch', () => {
    const baked = bakeMesh([squarePatch()])!;
    let transparent = 0;
    for (let i = 3; i < baked.pixels.length; i += 4) {
      if (baked.pixels[i] < 250) transparent++;
    }
    expect(transparent).toBe(0);
  });

  it('leaves the texels no patch reaches transparent', () => {
    // Two unit squares with a gap between them: the middle belongs to neither.
    const baked = bakeMesh([
      squarePatch({ x: 0, y: 0, w: 1, h: 1 }),
      squarePatch({ x: 3, y: 0, w: 1, h: 1 }),
    ])!;
    expect(texel(baked, 0.5, 0.5)[3]).toBe(0);
    expect(texel(baked, 0.02, 0.5)[3]).toBe(255);
  });

  it('blends the interior between the corners rather than banding', () => {
    const baked = bakeMesh([squarePatch(
      { x: 0, y: 0, w: 1, h: 1 },
      ['#000000', '#ffffff', '#ffffff', '#000000'],
    )])!;
    const mid = texel(baked, 0.5, 0.5);
    expect(mid[0]).toBeGreaterThan(100);
    expect(mid[0]).toBeLessThan(155);
    expect(texel(baked, 0.25, 0.5)[0]).toBeLessThan(mid[0]);
    expect(texel(baked, 0.75, 0.5)[0]).toBeGreaterThan(mid[0]);
  });

  it('takes the blend space, so a red-to-blue mesh can keep its chroma', () => {
    const patch = squarePatch({ x: 0, y: 0, w: 1, h: 1 }, ['#ff0000', '#0000ff', '#0000ff', '#ff0000']);
    const rgb = bakeMesh([patch], 'rgb')!;
    const lch = bakeMesh([patch], 'oklch')!;
    const a = texel(rgb, 0.5, 0.5);
    const b = texel(lch, 0.5, 0.5);
    expect(b).not.toEqual(a);
    // sRGB's midpoint is a dark purple; OKLCh's travels around and stays bright.
    expect(b[0] + b[1] + b[2]).toBeGreaterThan(a[0] + a[1] + a[2]);
  });
});
