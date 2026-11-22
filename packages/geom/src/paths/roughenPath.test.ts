import { describe, expect, it } from 'vitest';
import { PATH_M } from '../commands';
import type { PolygonPath } from '../path';
import { pathFromD } from './pathFromD';
import { roughenPath } from './roughenPath';

const square = pathFromD('M0 0 H10 V10 H0 Z');
const coords = (seed: number) => Array.from((roughenPath(square, { size: 1, seed }) as PolygonPath).coords);

describe('roughenPath', () => {
  it('roughens the same way for the same seed', () => {
    expect(coords(0.25)).toEqual(coords(0.25));
  });

  it('roughens differently for seeds that differ only in their fraction or past 32 bits', () => {
    expect(coords(0.25)).not.toEqual(coords(0));
    expect(coords(0.25)).not.toEqual(coords(0.75));
    expect(coords(2 ** 32 + 1)).not.toEqual(coords(1));
  });

  it('roughens each contour its own way, however many points a contour has', () => {
    // 70 segments at the largest detail put more than 65,536 points on the first contour.
    const zigzag = Array.from({ length: 70 }, (_, k) => `L${(k + 1) % 2} ${(k + 1) * 0.01}`).join(' ');
    const path = pathFromD(`M0 0 ${zigzag} M0 2 L1 2 L1 3 L0 3 L0 2`);
    const at = (size: number) => roughenPath(path, { size, detail: 1000 }) as PolygonPath;
    const one = at(1), two = at(2);
    const second = Array.from(one.commands).lastIndexOf(PATH_M);
    const offsets = Array.from({ length: one.coords.length / 2 }, (_, i) =>
      `${(two.coords[2 * i]! - one.coords[2 * i]!).toFixed(4)},${(two.coords[2 * i + 1]! - one.coords[2 * i + 1]!).toFixed(4)}`);
    const first = new Set(offsets.slice(0, second));
    expect(offsets.slice(second).filter((o) => first.has(o)).length).toBeLessThan(40);
  });
});
