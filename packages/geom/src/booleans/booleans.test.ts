import { describe, it, expect } from 'vitest';
import { pathUnion, pathIntersect, pathSubtract } from './index';
import type { Path } from '../path';
import { pointInPolygon } from '../polyline';
import { PATH_M, PATH_L, PATH_Z } from '../commands';

const rect = (x: number, y: number, w: number, h: number): Path => ({ kind: 'rect', x, y, width: w, height: h });

describe('paths with holes', () => {
  // Outer square 0..100 with an opposite-wound 40..60 ring inside it.
  const donut: Path = {
    kind: 'polygon',
    commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
    coords: Float32Array.of(0, 0, 100, 0, 100, 100, 0, 100, 40, 40, 40, 60, 60, 60, 60, 40),
    fillRule: 'nonzero',
  };

  const contours = (p: Path): number[][] => {
    if (p.kind === 'rect') throw new Error('expected polygon');
    const out: number[][] = [];
    let cur: number[] = [];
    for (let i = 0, ci = 0; i < p.commands.length; i++) {
      const cmd = p.commands[i];
      if (cmd === PATH_M) { cur = [p.coords[ci], p.coords[ci + 1]]; out.push(cur); ci += 2; }
      else if (cmd === PATH_L) { cur.push(p.coords[ci], p.coords[ci + 1]); ci += 2; }
    }
    void PATH_Z;
    return out;
  };

  it('keeps a hole through a union that does not touch it', () => {
    const u = pathUnion(donut, rect(200, 200, 10, 10));
    const rings = contours(u);
    // outer + hole + the disjoint square
    expect(rings).toHaveLength(3);
    expect(rings.some((r) => pointInPolygon(r, 50, 50))).toBe(true);
  });

  it('keeps a hole through a subtract that does not touch it', () => {
    const s = pathSubtract(donut, rect(200, 200, 10, 10));
    expect(contours(s)).toHaveLength(2);
  });

  it('does not intersect anything inside the hole', () => {
    const i = pathIntersect(donut, rect(45, 45, 10, 10));
    expect(contours(i)).toHaveLength(0);
  });
});
