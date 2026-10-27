import { describe, expect, it } from 'vitest';
import { ellipsePath } from '../paths/builder';
import { pathFromD } from '../paths/pathFromD';
import { createPathSnapIndex, findPathSnap, findPathSnaps } from './pathSnap';

const cross = createPathSnapIndex([pathFromD('M0 0 L100 100'), pathFromD('M0 100 L100 0')]);
const circle = createPathSnapIndex([ellipsePath({ x: -10, y: -10, width: 20, height: 20 })]);

describe('findPathSnap', () => {
  it('lands on an intersection in range, and on nothing out of it', () => {
    expect(findPathSnap(cross, { x: 53, y: 49 }, { radius: 5 })).toMatchObject({ kind: 'intersection', x: 50, y: 50 });
    expect(findPathSnap(cross, { x: 60, y: 50 }, { radius: 5, kinds: ['intersection'] })).toBeNull();
  });

  it('prefers the closest target, and the nearest point only when no other is in range', () => {
    const half = createPathSnapIndex([pathFromD('M0 0 L50 50')]);
    expect(findPathSnap(half, { x: 26, y: 24 }, { radius: 5 })).toMatchObject({ kind: 'midpoint', x: 25, y: 25 });
    const near = findPathSnap(cross, { x: 70, y: 72 }, { radius: 5 });
    expect(near?.kind).toBe('nearest');
    expect(near?.x).toBeCloseTo(71, 9);
    expect(near?.y).toBeCloseTo(71, 9);
  });

  it('turns a kind off', () => {
    const half = createPathSnapIndex([pathFromD('M0 0 L50 50')]);
    const hit = findPathSnap(half, { x: 26, y: 24 }, { radius: 5, kinds: ['intersection', 'nearest'] });
    expect(hit?.kind).toBe('nearest');
  });

  it("finds a circle's extremes and its quadrant points", () => {
    const top = findPathSnap(circle, { x: 1, y: -11 }, { radius: 3, kinds: ['extremum'] });
    expect(top?.x).toBeCloseTo(0, 6);
    expect(top?.y).toBeCloseTo(-10, 6);
    const right = findPathSnap(circle, { x: 11, y: 1 }, { radius: 3, kinds: ['quadrant'] });
    expect(right?.x).toBeCloseTo(10, 6);
    expect(right?.y).toBeCloseTo(0, 6);
  });

  it('finds the tangent point from the origin', () => {
    // From 20 below the center of a radius-10 circle, the tangent touches 60° off
    // the axis — to within how closely four cubics follow a circle.
    const hit = findPathSnap(circle, { x: 9, y: 4 }, { radius: 3, origin: { x: 0, y: 20 }, kinds: ['tangent'] });
    expect(hit?.kind).toBe('tangent');
    expect(hit!.x).toBeCloseTo(10 * Math.sin(Math.PI / 3), 1);
    expect(hit!.y).toBeCloseTo(5, 1);
  });

  it('finds the foot of the perpendicular from the origin', () => {
    const line = createPathSnapIndex([pathFromD('M0 0 L100 0')]);
    const hit = findPathSnap(line, { x: 31, y: 2 }, { radius: 5, origin: { x: 30, y: 40 }, kinds: ['perpendicular'] });
    expect(hit).toMatchObject({ kind: 'perpendicular', y: 0 });
    expect(hit!.x).toBeCloseTo(30, 9);
    // Without an origin there is nothing to be perpendicular from.
    expect(findPathSnap(line, { x: 31, y: 2 }, { radius: 5, kinds: ['perpendicular'] })).toBeNull();
  });

  it('measures the radius at the given scale', () => {
    expect(findPathSnap(cross, { x: 53, y: 50 }, { radius: 5, kinds: ['intersection'], scale: { x: 2, y: 2 } })).toBeNull();
    expect(findPathSnap(cross, { x: 50, y: 53 }, { radius: 5, kinds: ['intersection'], scale: { x: 4, y: 1 } })).not.toBeNull();
  });

  it('skips the paths a drag is moving, and the crossings they make', () => {
    expect(findPathSnap(cross, { x: 50, y: 50 }, { radius: 5, skip: (i) => i === 1 })?.kind).not.toBe('intersection');
    expect(findPathSnap(cross, { x: 50, y: 50 }, { radius: 5, skip: () => true })).toBeNull();
  });
});

describe('anchor and center targets', () => {
  it("snaps to a segment's ends and to a caller's center", () => {
    const box = createPathSnapIndex([pathFromD('M0 0 H40 V20 H0 Z')], [{ kind: 'center', x: 20, y: 10, paths: [0] }]);
    expect(findPathSnap(box, { x: 38, y: 2 }, { radius: 4 })).toMatchObject({ kind: 'anchor', x: 40, y: 0 });
    expect(findPathSnap(box, { x: 21, y: 11 }, { radius: 4 })).toMatchObject({ kind: 'center', x: 20, y: 10 });
  });
});

describe('findPathSnaps', () => {
  it('returns every kind in range, and nearest only when none else is', () => {
    const line = createPathSnapIndex([pathFromD('M0 0 L10 0')]);
    expect(findPathSnaps(line, { x: 5, y: 1 }, { radius: 6 }).map((h) => h.kind).sort()).toEqual(['anchor', 'anchor', 'midpoint']);
    expect(findPathSnaps(line, { x: 3, y: 1 }, { radius: 1.5 }).map((h) => h.kind)).toEqual(['nearest']);
  });
});

describe('findPathSnaps over many paths', () => {
  // A 40×40 grid of short strokes, 10 apart.
  const grid = Array.from({ length: 1600 }, (_, i) => {
    const x = (i % 40) * 10;
    const y = Math.floor(i / 40) * 10;
    return pathFromD(`M${x} ${y} L${x + 4} ${y + 4}`);
  });

  /** `index` with each target list and segment list counting the entries read from it. */
  function counted(index: ReturnType<typeof createPathSnapIndex>) {
    let reads = 0;
    const watch = <T extends object>(list: readonly T[]): readonly T[] => new Proxy(list as T[], {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const lists = new Map<string, readonly unknown[]>();
    return {
      index: {
        paths: index.paths,
        segments: watch(index.segments.map((s) => watch(s))),
        targets: (kind: Parameters<typeof index.targets>[0]) => {
          if (!lists.has(kind)) lists.set(kind, watch(index.targets(kind)));
          return lists.get(kind) as ReturnType<typeof index.targets>;
        },
      },
      reads: () => reads,
      reset: () => { reads = 0; },
    };
  }

  it('finds every target in range, as a scan of them all would', () => {
    const index = createPathSnapIndex(grid);
    const probe = { x: 202, y: 201 };
    const hits = findPathSnaps(index, probe, { radius: 6, origin: { x: 0, y: 300 } });
    const kinds = ['anchor', 'midpoint'] as const;
    for (const kind of kinds) {
      const want = index.targets(kind).filter((t) => Math.hypot(t.x - probe.x, t.y - probe.y) <= 6);
      expect(hits.filter((h) => h.kind === kind).map((h) => [h.x, h.y]).sort())
        .toEqual(want.map((t) => [t.x, t.y]).sort());
    }
  });

  it('measures nothing along an axis scaled to zero, so every target along it is in range', () => {
    const hits = findPathSnaps(createPathSnapIndex(grid), { x: -500, y: 0 }, { radius: 0.5, scale: { x: 0, y: 1 }, kinds: ['anchor'] });
    expect(hits).toHaveLength(40);
  });

  it('reads only the targets and segments near the probe once it has looked once', () => {
    const c = counted(createPathSnapIndex(grid));
    const query = { radius: 6, kinds: ['anchor', 'midpoint', 'perpendicular', 'nearest'] as const, origin: { x: 0, y: 300 } };
    findPathSnaps(c.index, { x: 202, y: 201 }, query);
    c.reset();
    findPathSnaps(c.index, { x: 302, y: 101 }, query);
    expect(c.reads()).toBeLessThan(100);
  });
});
