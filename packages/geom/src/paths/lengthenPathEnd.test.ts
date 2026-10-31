import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { anchorsToPath, pathToAnchors, type PenAnchor } from './anchors';
import type { AnchorSet } from './anchorEdits';
import { cubicPointAt } from './cubicMath';
import { cubicDerivativeAt } from './curvature';
import { segmentLength } from './segmentLength';
import {
  lengthenPathEnd,
  lengthToward,
  openEndAt,
  pathEndFrame,
} from './lengthenPathEnd';

function decode(build: (b: PathBuilder) => void): AnchorSet {
  const b = new PathBuilder();
  build(b);
  return pathToAnchors(b.build());
}

/** Open line (0,0) → (100,0). */
const line = () => decode((b) => { b.moveTo(0, 0); b.lineTo(100, 0); });

/** Open quarter-ish arc of radius 100 about (0,100), from (0,0) curling to (100,100),
 *  then the same as a cubic ending at (100,100) heading +y. */
const K = 0.5522847498;
const quarter = () => decode((b) => {
  b.moveTo(0, 0);
  b.curveTo(100 * K, 0, 100, 100 - 100 * K, 100, 100);
});

/** Arc length of every segment of the subpath, summed. */
function subLength(sub: readonly PenAnchor[]): number {
  let total = 0;
  for (let i = 1; i < sub.length; i++) {
    const a = sub[i - 1];
    const b = sub[i];
    if (!a.outHandle && !b.inHandle) total += Math.hypot(b.x - a.x, b.y - a.y);
    else total += segmentLength([a, a.outHandle ?? a, b.inHandle ?? b, b]);
  }
  return total;
}

describe('openEndAt', () => {
  it('names the first and last anchors of an open subpath, and nothing else', () => {
    const set = decode((b) => { b.moveTo(0, 0); b.lineTo(10, 0); b.lineTo(20, 0); });
    expect(openEndAt(set, 0)).toEqual({ sub: 0, end: 'first' });
    expect(openEndAt(set, 2)).toEqual({ sub: 0, end: 'last' });
    expect(openEndAt(set, 1)).toBeNull();
  });

  it('answers null on a closed subpath and on a lone point', () => {
    const closed = decode((b) => { b.moveTo(0, 0); b.lineTo(10, 0); b.lineTo(10, 10); b.close(); });
    expect(openEndAt(closed, 0)).toBeNull();
    const dot = decode((b) => { b.moveTo(5, 5); });
    expect(openEndAt(dot, 0)).toBeNull();
  });
});

describe('lengthenPathEnd along the tangent', () => {
  it('lengthens a straight end segment without adding an anchor', () => {
    const set = line();
    expect(lengthenPathEnd(set, { sub: 0, end: 'last' }, 25, 'tangent')).toBe(true);
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 125, y: 0 }]);
  });

  it('extends the start backward along its own tangent', () => {
    const set = line();
    lengthenPathEnd(set, { sub: 0, end: 'first' }, 10, 'tangent');
    expect(set.anchors[0]).toEqual([{ x: -10, y: 0 }, { x: 100, y: 0 }]);
  });

  it('continues a curved end with a straight run along its end tangent', () => {
    const set = quarter();
    lengthenPathEnd(set, { sub: 0, end: 'last' }, 30, 'tangent');
    const sub = set.anchors[0];
    expect(sub).toHaveLength(3);
    expect(sub[2].x).toBeCloseTo(100, 4);
    expect(sub[2].y).toBeCloseTo(130, 4);
    expect(sub[2].inHandle).toBeUndefined();
    expect(sub[1].outHandle).toBeUndefined();
  });

  it('reads the direction from the far control when the near one sits on the end', () => {
    const set = decode((b) => { b.moveTo(0, 0); b.curveTo(50, 0, 100, 0, 100, 0); });
    lengthenPathEnd(set, { sub: 0, end: 'last' }, 10, 'tangent');
    const end = set.anchors[0].at(-1)!;
    expect(end.x).toBeCloseTo(110, 4);
    expect(end.y).toBeCloseTo(0, 4);
  });
});

describe('lengthenPathEnd along the curvature', () => {
  it('continues the end as a circular arc of the end curvature, the requested length long', () => {
    const set = quarter();
    const before = subLength(set.anchors[0]);
    const { curvature } = pathEndFrame(set, { sub: 0, end: 'last' })!;
    const r = 1 / Math.abs(curvature);
    // Another quarter turn about the end's center of curvature.
    lengthenPathEnd(set, { sub: 0, end: 'last' }, (Math.PI / 2) * r, 'curvature');
    const sub = set.anchors[0];
    expect(sub).toHaveLength(3);
    expect(subLength(sub) - before).toBeCloseTo((Math.PI / 2) * r, 0);
    // The new piece starts smooth: its out handle lies on the line of the old in handle.
    const joint = sub[1];
    const inDir = { x: joint.x - joint.inHandle!.x, y: joint.y - joint.inHandle!.y };
    const outDir = { x: joint.outHandle!.x - joint.x, y: joint.outHandle!.y - joint.y };
    expect(inDir.x * outDir.y - inDir.y * outDir.x).toBeCloseTo(0, 6);
    expect(inDir.x * outDir.x + inDir.y * outDir.y).toBeGreaterThan(0);
    // The arc stays on its circle.
    const center = { x: 100 - r * Math.sign(curvature), y: 100 };
    const mid = cubicPointAt(joint, joint.outHandle!, sub[2].inHandle!, sub[2], 0.5);
    expect(Math.hypot(mid.x - center.x, mid.y - center.y)).toBeCloseTo(r, 0);
  });

  it('splits a long arc into pieces no wider than a quarter turn', () => {
    const set = quarter();
    const r = 1 / Math.abs(pathEndFrame(set, { sub: 0, end: 'last' })!.curvature);
    lengthenPathEnd(set, { sub: 0, end: 'last' }, Math.PI * r, 'curvature');
    expect(set.anchors[0]).toHaveLength(4);
  });

  it('stops at one full turn', () => {
    const a = quarter();
    const b = quarter();
    const r = 1 / Math.abs(pathEndFrame(a, { sub: 0, end: 'last' })!.curvature);
    lengthenPathEnd(a, { sub: 0, end: 'last' }, 2 * Math.PI * r, 'curvature');
    lengthenPathEnd(b, { sub: 0, end: 'last' }, 9 * Math.PI * r, 'curvature');
    expect(b.anchors[0]).toHaveLength(a.anchors[0].length);
    const [ea, eb] = [a.anchors[0].at(-1)!, b.anchors[0].at(-1)!];
    expect(eb.x).toBeCloseTo(ea.x, 6);
    expect(eb.y).toBeCloseTo(ea.y, 6);
  });

  it('lengthens a straight end, whose curvature is zero, like the tangent does', () => {
    const set = line();
    lengthenPathEnd(set, { sub: 0, end: 'last' }, 25, 'curvature');
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 125, y: 0 }]);
  });
});

describe('lengthenPathEnd eased', () => {
  it('eases a curved end out of its curvature into a straight run, the requested length long', () => {
    const set = quarter();
    const before = subLength(set.anchors[0]);
    lengthenPathEnd(set, { sub: 0, end: 'last' }, 150, 'eased');
    const sub = set.anchors[0];
    expect(subLength(sub) - before).toBeCloseTo(150, 2);
    const tip = sub[sub.length - 1];
    expect(tip.inHandle).toBeUndefined();
    expect(sub[sub.length - 2].inHandle).toBeDefined();
  });

  it('lengthens a straight end segment in place, as the tangent does', () => {
    const eased = line();
    const tangent = line();
    lengthenPathEnd(eased, { sub: 0, end: 'last' }, 25, 'eased');
    lengthenPathEnd(tangent, { sub: 0, end: 'last' }, 25, 'tangent');
    expect(eased.anchors).toEqual(tangent.anchors);
  });

  it('measures a point back to the distance that reached it', () => {
    for (const d of [20, 80, 200]) {
      const set = quarter();
      lengthenPathEnd(set, { sub: 0, end: 'last' }, d, 'eased');
      const tip = set.anchors[0][set.anchors[0].length - 1];
      expect(lengthToward(quarter(), { sub: 0, end: 'last' }, 'eased', tip)).toBeCloseTo(d, 2);
    }
    expect(lengthToward(quarter(), { sub: 0, end: 'last' }, 'eased', { x: 100, y: 90 })).toBeCloseTo(-10, 6);
  });
});

describe('lengthenPathEnd with a negative distance', () => {
  it('trims a straight end along itself', () => {
    const set = line();
    lengthenPathEnd(set, { sub: 0, end: 'last' }, -40, 'tangent');
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 60, y: 0 }]);
  });

  it('trims a curved end by arc length, keeping the shape it had', () => {
    const set = quarter();
    const before = subLength(set.anchors[0]);
    const original = quarter().anchors[0];
    lengthenPathEnd(set, { sub: 0, end: 'last' }, -50, 'curvature');
    const sub = set.anchors[0];
    expect(sub).toHaveLength(2);
    expect(subLength(sub)).toBeCloseTo(before - 50, 1);
    // The trimmed end lies on the original curve, heading the same way.
    const [a, b] = original;
    const end = sub[1];
    let best = Infinity;
    for (let i = 0; i <= 1000; i++) {
      const p = cubicPointAt(a, a.outHandle!, b.inHandle!, b, i / 1000);
      best = Math.min(best, Math.hypot(p.x - end.x, p.y - end.y));
    }
    expect(best).toBeLessThan(0.2);
  });

  it('trims through whole segments, dropping the anchors it passes', () => {
    const set = decode((b) => { b.moveTo(0, 0); b.lineTo(10, 0); b.lineTo(10, 10); });
    lengthenPathEnd(set, { sub: 0, end: 'last' }, -15, 'tangent');
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  });

  it('trims the start', () => {
    const set = decode((b) => { b.moveTo(0, 0); b.lineTo(10, 0); b.lineTo(10, 10); });
    lengthenPathEnd(set, { sub: 0, end: 'first' }, -15, 'tangent');
    expect(set.anchors[0]).toEqual([{ x: 10, y: 5 }, { x: 10, y: 10 }]);
  });

  it('never trims the whole subpath away', () => {
    const set = line();
    lengthenPathEnd(set, { sub: 0, end: 'last' }, -500, 'tangent');
    const sub = set.anchors[0];
    expect(sub).toHaveLength(2);
    expect(sub[1].x).toBeGreaterThan(0);
    expect(sub[1].x).toBeLessThan(1);
  });
});

describe('lengthenPathEnd round trip', () => {
  it('leaves the other subpaths alone and encodes back to a path', () => {
    const set = decode((b) => {
      b.moveTo(0, 0); b.lineTo(10, 0);
      b.moveTo(0, 20); b.lineTo(10, 20);
    });
    lengthenPathEnd(set, { sub: 1, end: 'last' }, 5, 'tangent');
    expect(set.anchors[0]).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    const path = anchorsToPath(set.anchors, set.closed);
    expect(Array.from(path.coords)).toEqual([0, 0, 10, 0, 0, 20, 15, 20]);
  });

  it('refuses a closed subpath', () => {
    const set = decode((b) => { b.moveTo(0, 0); b.lineTo(10, 0); b.lineTo(10, 10); b.close(); });
    expect(lengthenPathEnd(set, { sub: 0, end: 'last' }, 5, 'tangent')).toBe(false);
  });
});

describe('lengthToward', () => {
  it('projects the point onto the end tangent', () => {
    const set = line();
    expect(lengthToward(set, { sub: 0, end: 'last' }, 'tangent', { x: 130, y: 40 })).toBeCloseTo(30);
    expect(lengthToward(set, { sub: 0, end: 'last' }, 'tangent', { x: 80, y: -5 })).toBeCloseTo(-20);
    expect(lengthToward(set, { sub: 0, end: 'first' }, 'tangent', { x: -7, y: 3 })).toBeCloseTo(7);
  });

  it('measures around the circle of curvature, unwrapping toward the last answer', () => {
    const set = quarter();
    const end = { sub: 0, end: 'last' } as const;
    const { point, tangent, curvature } = pathEndFrame(set, end)!;
    const r = 1 / Math.abs(curvature);
    const s = Math.sign(curvature);
    const center = { x: point.x - s * tangent.y * r, y: point.y + s * tangent.x * r };
    const around = (turn: number) => {
      const vx = point.x - center.x;
      const vy = point.y - center.y;
      const c = Math.cos(s * turn);
      const n = Math.sin(s * turn);
      return { x: center.x + vx * c - vy * n, y: center.y + vx * n + vy * c };
    };
    expect(lengthToward(set, end, 'curvature', around(Math.PI / 2))).toBeCloseTo((Math.PI / 2) * r, 3);
    // Past half a turn, a fresh measurement wraps back to negative; one continuing a
    // drag that was already most of the way round keeps going.
    const far = around(1.5 * Math.PI);
    expect(lengthToward(set, end, 'curvature', far)).toBeLessThan(0);
    expect(lengthToward(set, end, 'curvature', far, 1.2 * Math.PI * r)).toBeCloseTo(1.5 * Math.PI * r, 3);
  });

  it('matches the end tangent the curve actually has', () => {
    const set = quarter();
    const [a, b] = set.anchors[0];
    const d = cubicDerivativeAt(a, a.outHandle!, b.inHandle!, b, 1);
    const { tangent } = pathEndFrame(set, { sub: 0, end: 'last' })!;
    expect(tangent.x * d.y - tangent.y * d.x).toBeCloseTo(0, 6);
  });
});
