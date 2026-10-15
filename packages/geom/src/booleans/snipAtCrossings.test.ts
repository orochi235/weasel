import { describe, expect, it } from 'vitest';
import { PathBuilder } from '../paths/builder';
import { pathToAnchors } from '../paths/anchors';
import type { Path, PolygonPath } from '../path';
import { snipPathsAtCrossings } from './snipAtCrossings';

function line(x0: number, y0: number, x1: number, y1: number): PolygonPath {
  return new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();
}

const ends = (p: Path) => {
  const sub = pathToAnchors(p as PolygonPath).anchors[0];
  return [sub[0], sub[sub.length - 1]].map((a) => [Math.round(a.x * 1000) / 1000, Math.round(a.y * 1000) / 1000]);
};

describe('snipPathsAtCrossings', () => {
  it('cuts two crossing lines into four runs at the crossing', () => {
    const [a, b] = snipPathsAtCrossings([line(0, 0, 10, 10), line(0, 10, 10, 0)]);
    expect(a!.map(ends)).toEqual([[[0, 0], [5, 5]], [[5, 5], [10, 10]]]);
    expect(b!.map(ends)).toEqual([[[0, 10], [5, 5]], [[5, 5], [10, 0]]]);
  });

  it('opens a closed path where another crosses it', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
    const [sq, cut] = snipPathsAtCrossings([square, line(5, -5, 5, 15)]);
    expect(sq).toHaveLength(2);
    expect(sq!.every((p) => pathToAnchors(p as PolygonPath).closed[0] === false)).toBe(true);
    expect(sq!.map(ends).flat()).toEqual(expect.arrayContaining([[5, 0], [5, 10]]));
    expect(cut).toHaveLength(3);
  });

  it('finds a crossing on a cutting curve', () => {
    const arc = new PathBuilder().moveTo(0, 0).curveTo(0, 20, 20, 20, 20, 0).build();
    const [cut] = snipPathsAtCrossings([line(10, -5, 10, 30), arc]);
    const [, at] = ends(cut![0]);
    expect(at[0]).toBeCloseTo(10, 3);
    expect(at[1]).toBeCloseTo(15, 1);
  });

  it('leaves alone a path nothing crosses, and does not cut a path at its own crossing', () => {
    const loop = new PathBuilder().moveTo(0, 0).lineTo(10, 10).lineTo(10, 0).lineTo(0, 10).build();
    expect(snipPathsAtCrossings([loop, line(50, 0, 60, 0)])).toEqual([null, null]);
  });
});
