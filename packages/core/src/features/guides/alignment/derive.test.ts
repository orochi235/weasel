import { describe, expect, it } from 'vitest';
import { deriveAlignmentGuides } from './derive';

const box = { x: 10, y: 20, width: 100, height: 40 }; // L=10 cx=60 R=110 / T=20 cy=40 B=60

describe('deriveAlignmentGuides', () => {
  it('emits 3 x-guides and 3 y-guides for one target', () => {
    const g = deriveAlignmentGuides([box]);
    const xs = g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b);
    const ys = g.filter((q) => q.axis === 'y').map((q) => q.offset).sort((a, b) => a - b);
    expect(xs).toEqual([10, 60, 110]);
    expect(ys).toEqual([20, 40, 60]);
  });

  it('edges:false drops the 4 edge guides, keeps the 2 centers', () => {
    const g = deriveAlignmentGuides([box], { edges: false });
    expect(g.filter((q) => q.axis === 'x').map((q) => q.offset)).toEqual([60]);
    expect(g.filter((q) => q.axis === 'y').map((q) => q.offset)).toEqual([40]);
  });

  it('centers:false drops the 2 center guides, keeps the 4 edges', () => {
    const g = deriveAlignmentGuides([box], { centers: false });
    expect(g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b)).toEqual([10, 110]);
    expect(g.filter((q) => q.axis === 'y').map((q) => q.offset).sort((a, b) => a - b)).toEqual([20, 60]);
  });

  it('includes the page box edges + center', () => {
    const g = deriveAlignmentGuides([], { page: { x: 0, y: 0, width: 200, height: 200 } });
    const xs = g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b);
    expect(xs).toEqual([0, 100, 200]);
  });

  it('dedups overlapping offsets to a single candidate', () => {
    // two boxes sharing left edge x=10
    const g = deriveAlignmentGuides([box, { x: 10, y: 300, width: 50, height: 50 }]);
    const leftTens = g.filter((q) => q.axis === 'x' && Math.abs(q.offset - 10) < 1e-6);
    expect(leftTens.length).toBe(1);
  });

  it('a rotated target advertises its ink edges, not its stored box', () => {
    // 40x10 turned a quarter turn about its centre (60, 5): ink x 55..65.
    const g = deriveAlignmentGuides([{ x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 }]);
    const xs = g.filter((q) => q.axis === 'x').map((q) => q.offset).sort((a, b) => a - b);
    expect(xs).toEqual([55, 60, 65]);
  });

  it('ids are stable and offset-derived', () => {
    const g = deriveAlignmentGuides([box]);
    const left = g.find((q) => q.axis === 'x' && q.offset === 10)!;
    expect(left.id).toBe('align:x:10.000');
  });
});
