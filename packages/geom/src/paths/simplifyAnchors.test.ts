import { describe, expect, it } from 'vitest';
import type { AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { nearestOnLine } from '../nearest';
import { simplifyAnchorsAt } from './simplifyAnchors';

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const clone = (set: AnchorSet): AnchorSet => structuredClone(set);

/** A gentle wave sampled densely as an open polyline: every anchor is redundant. */
function wave(count = 81): AnchorSet {
  return {
    anchors: [range(0, count - 1).map((i) => ({ x: i * 5, y: 20 * Math.sin(i / 8) }))],
    closed: [false],
  };
}

/** A flat line sampled densely, with one smooth bump `height` tall at x = 200. */
function bumped(height: number): AnchorSet {
  return {
    anchors: [range(0, 80).map((i) => ({ x: i * 5, y: -height * Math.exp(-(((i * 5 - 200) / 15) ** 2)) }))],
    closed: [false],
  };
}

/** How far up the bump the curve reaches. */
const peak = (sub: readonly PenAnchor[]): number => Math.max(...sampleSub(sub).map((p) => -p.y));

/** Points along every segment of `sub`. */
function sampleSub(sub: readonly PenAnchor[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < sub.length; i++) {
    const a = sub[i], b = sub[i + 1];
    for (let k = 0; k <= 16; k++) out.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 16));
  }
  return out;
}

/** The farthest any point of `sub` strays from the polyline through `poly`. */
function worstOff(sub: readonly PenAnchor[], poly: readonly PenAnchor[]): number {
  let worst = 0;
  for (const p of sampleSub(sub)) {
    let best = Infinity;
    for (let i = 0; i + 1 < poly.length; i++) {
      best = Math.min(best, nearestOnLine(p.x, p.y, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y).dist);
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

describe('simplifyAnchorsAt', () => {
  it('refits the brushed stretch with fewer anchors, within the tolerance of the original', () => {
    const original = wave();
    const set = clone(original);
    expect(simplifyAnchorsAt(set, range(20, 60), 0.5)).toBe(true);
    expect(set.anchors[0].length).toBeLessThan(original.anchors[0].length - 30);
    expect(worstOff(set.anchors[0], original.anchors[0])).toBeLessThan(0.5 + 0.05);
  });

  it('leaves every anchor outside the brushed stretch exactly as it was', () => {
    const original = wave();
    const set = clone(original);
    simplifyAnchorsAt(set, range(20, 60), 0.5);
    const sub = set.anchors[0];
    expect(sub.slice(0, 20)).toEqual(original.anchors[0].slice(0, 20));
    expect(sub.slice(-20)).toEqual(original.anchors[0].slice(-20));
  });

  it('keeps a detail under the brush that the tolerance cannot lose', () => {
    const original = bumped(10);
    const set = clone(original);
    expect(simplifyAnchorsAt(set, range(0, 80), 0.5)).toBe(true);
    expect(set.anchors[0].length).toBeLessThan(20);
    expect(peak(set.anchors[0])).toBeGreaterThan(10 - 0.5);
    expect(worstOff(set.anchors[0], original.anchors[0])).toBeLessThan(0.5 + 0.05);
  });

  it('holds a sharp turn inside the brushed stretch, both ways within the tolerance', () => {
    // A dense run out along x, a hairpin, and back above it: a chord across
    // the hairpin would lie near the outward run, so measure both ways.
    const out = range(0, 40).map((i) => ({ x: i * 1.5, y: 0 }));
    const back = range(1, 40).map((i) => ({ x: 60 - i * 1.5, y: 4 + 0.05 * i * i }));
    const original: AnchorSet = { anchors: [[...out, ...back]], closed: [false] };
    const set = clone(original);
    expect(simplifyAnchorsAt(set, range(0, 80), 1)).toBe(true);
    expect(set.anchors[0].length).toBeLessThan(20);
    expect(worstOff(set.anchors[0], original.anchors[0])).toBeLessThan(1.05);
    expect(worstOff(original.anchors[0], sampleSub(set.anchors[0]))).toBeLessThan(1.05);
  });

  it('changes nothing where no anchor can go', () => {
    const set = wave();
    expect(simplifyAnchorsAt(set, [10, 11], 0.5)).toBe(false);
    expect(simplifyAnchorsAt(set, [], 0.5)).toBe(false);
    expect(set).toEqual(wave());
  });

  it('refits a stretch that runs across a closed subpath\'s seam', () => {
    const ring: AnchorSet = {
      anchors: [range(0, 99).map((i) => {
        const t = (i / 100) * Math.PI * 2;
        return { x: 100 * Math.cos(t), y: 100 * Math.sin(t) };
      })],
      closed: [true],
    };
    const brushed = [...range(90, 99), ...range(0, 10)];
    expect(simplifyAnchorsAt(ring, brushed, 0.5)).toBe(true);
    const sub = ring.anchors[0];
    expect(sub.length).toBeLessThan(90);
    expect(ring.closed).toEqual([true]);
    // An anchor well away from the seam is still there.
    expect(sub.some((a) => Math.abs(a.x + 100) < 1e-9 && Math.abs(a.y) < 1e-6)).toBe(true);
  });

  it('simplifies a whole closed subpath when every anchor is brushed', () => {
    const ring: AnchorSet = {
      anchors: [range(0, 199).map((i) => {
        const t = (i / 200) * Math.PI * 2;
        return { x: 100 * Math.cos(t), y: 100 * Math.sin(t) };
      })],
      closed: [true],
    };
    expect(simplifyAnchorsAt(ring, range(0, 199), 0.5)).toBe(true);
    expect(ring.anchors[0].length).toBeLessThan(10);
  });
});
