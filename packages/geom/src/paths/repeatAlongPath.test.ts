import { describe, expect, it } from 'vitest';
import { linePath, rectPath } from './builder';
import { boundsOfPath } from './bounds';
import { repeatAlongPath, stationsAlongPath, type RepeatAlongPathOptions } from './repeatAlongPath';

const line = linePath({ x: 0, y: 0 }, { x: 100, y: 0 });
const at = (opts: RepeatAlongPathOptions) => stationsAlongPath(line, opts).map((s) => s.distance);

describe('stationsAlongPath', () => {
  it('spreads a count end to end on an open path', () => {
    expect(at({ count: 5 })).toEqual([0, 25, 50, 75, 100]);
  });

  it('spreads a count evenly round a closed path, with no copy on the seam twice', () => {
    expect(stationsAlongPath(rectPath(0, 0, 10, 10), { count: 4 }).map((s) => s.distance)).toEqual([0, 10, 20, 30]);
  });

  it('places as many as fit at a spacing, aligned within the leftover', () => {
    expect(at({ spacing: 30 })).toEqual([0, 30, 60, 90]);
    expect(at({ spacing: 30, align: 'end' })).toEqual([10, 40, 70, 100]);
    expect(at({ spacing: 30, align: 'center' })).toEqual([5, 35, 65, 95]);
    expect(at({ spacing: 30, count: 2 })).toEqual([0, 30]);
  });

  it('drops a copy slid off an open end', () => {
    expect(at({ count: 3, offset: 10 })).toEqual([10, 60]);
  });

  it('reports the heading', () => {
    const [s] = stationsAlongPath(linePath({ x: 0, y: 0 }, { x: 0, y: 10 }), { count: 1 });
    expect(s!.angle).toBeCloseTo(Math.PI / 2);
  });
});

describe('repeatAlongPath', () => {
  it('centers each copy on its station', () => {
    const copies = repeatAlongPath(rectPath(-100, -100, 4, 2), line, { count: 3, orient: false });
    expect(copies.map((c) => boundsOfPath(c).x)).toEqual([-2, 48, 98]);
  });

  it('turns copies to the heading when oriented', () => {
    const [copy] = repeatAlongPath(rectPath(0, 0, 4, 2), linePath({ x: 0, y: 0 }, { x: 0, y: 10 }), { count: 1 });
    const b = boundsOfPath(copy!);
    expect(b.width).toBeCloseTo(2);
    expect(b.height).toBeCloseTo(4);
  });
});
