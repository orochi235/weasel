import { describe, expect, it } from 'vitest';
import { pathFromD } from './pathFromD';
import { pathToAnchors, type PenAnchor } from './anchors';
import type { AnchorSet } from './anchorEdits';
import { cubicPointAt } from './cubicMath';
import { addExtremaAnchors, segmentExtremaTs } from './extremaAnchors';
import { pathDistanceToPoint } from './pathDistance';
import { anchorsToPath } from './anchors';
import { nearestOnCubic } from '../nearest';

/** A closed blob of three curves, none of whose anchors is at an extreme. */
const BLOB = 'M 120 40 C 200 20 260 120 200 180 C 150 230 40 200 50 120 C 55 80 80 50 120 40 Z';

function decode(d: string): AnchorSet {
  const path = pathFromD(d);
  if (path.kind !== 'polygon') throw new Error('expected a polygon');
  return pathToAnchors(path);
}

/** Points along every segment of `set`. */
function sampleAll(set: AnchorSet, per = 24): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  set.anchors.forEach((sub, s) => {
    const segs = sub.length - (set.closed[s] ? 0 : 1);
    for (let i = 0; i < segs; i++) {
      const a = sub[i];
      const b = sub[(i + 1) % sub.length];
      for (let k = 0; k <= per; k++) out.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / per));
    }
  });
  return out;
}

const isAxisTangent = (a: PenAnchor): boolean => {
  const h = a.outHandle!;
  return Math.abs(h.x - a.x) < 1e-6 || Math.abs(h.y - a.y) < 1e-6;
};

describe('addExtremaAnchors', () => {
  it('puts an axis-tangent anchor at every extreme and keeps the shape', () => {
    const before = decode(BLOB);
    const set = decode(BLOB);
    const added = addExtremaAnchors(set);
    expect(added.length).toBeGreaterThanOrEqual(4);
    const flat = set.anchors.flat();
    for (const k of added) expect(isAxisTangent(flat[k])).toBe(true);
    const after = anchorsToPath(set.anchors, set.closed);
    for (const p of sampleAll(before)) expect(pathDistanceToPoint(after, p.x, p.y)).toBeLessThan(1e-3);
  });

  it('adds nothing on a second pass', () => {
    const set = decode(BLOB);
    addExtremaAnchors(set);
    expect(addExtremaAnchors(set)).toEqual([]);
  });

  it('splits only the segments `include` names', () => {
    const set = decode(BLOB);
    const added = addExtremaAnchors(set, (_sub, segIdx) => segIdx === 0);
    const first = decode(BLOB).anchors[0];
    expect(added.length).toBe(segmentExtremaTs(first[0], first[1]).length);
    expect(added.every((k) => k >= 1 && k <= added.length)).toBe(true);
  });

  it('leaves straight segments alone', () => {
    const set = decode('M 0 0 L 100 50 L 0 100 Z');
    expect(addExtremaAnchors(set)).toEqual([]);
  });

  it('finds the extreme of a single arch exactly', () => {
    const set = decode('M 0 0 C 0 -100 100 -100 100 0');
    const [k] = addExtremaAnchors(set);
    const top = set.anchors[0][k];
    expect(top.x).toBeCloseTo(50, 6);
    expect(top.y).toBeCloseTo(-75, 6);
    const near = nearestOnCubic(50, -75, 0, 0, 0, -100, 100, -100, 100, 0);
    expect(near.dist).toBeLessThan(1e-6);
  });

  it('splits at the turns along one axis alone', () => {
    // The arch turns in y at its top, and nowhere in x.
    expect(addExtremaAnchors(decode('M 0 0 C 0 -100 100 -100 100 0'), undefined, 'x')).toEqual([]);
    expect(addExtremaAnchors(decode('M 0 0 C 0 -100 100 -100 100 0'), undefined, 'y')).toHaveLength(1);
    const both = addExtremaAnchors(decode(BLOB)).length;
    const xs = addExtremaAnchors(decode(BLOB), undefined, 'x').length;
    const ys = addExtremaAnchors(decode(BLOB), undefined, 'y').length;
    expect(xs).toBeGreaterThan(0);
    expect(ys).toBeGreaterThan(0);
    expect(xs + ys).toBe(both);
  });
});
