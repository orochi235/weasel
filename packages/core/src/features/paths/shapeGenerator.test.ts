import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathInWorld, starPath, regularPolygonPath, type PolygonPath } from '@weasel-js/geom';
import {
  regenerateShape,
  settleShapeGenerator,
  shapeGeneratorOf,
  shapeGeneratorPath,
  withoutShapeGenerator,
  type ShapeGenerator,
} from './shapeGenerator';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };

/** A star as the insert dep commits one: the path around its center, the pose its circle's box. */
function star(points: number, rotation = 0, pose?: Partial<Pose>) {
  const generator: ShapeGenerator = { kind: 'star', points, innerRadiusRatio: 0.5, rotation };
  return {
    pose: { x: 50, y: 50, width: 100, height: 100, ...pose } as Pose,
    data: { path: starPath({ x: 100, y: 100 }, 50, points, 25, rotation), generator, fill: 'red' },
  };
}

function vertices(p: PolygonPath): { x: number; y: number }[] {
  const out = [];
  for (let i = 0; i + 1 < p.coords.length; i += 2) out.push({ x: p.coords[i], y: p.coords[i + 1] });
  return out;
}

const worldOf = (n: { pose: Pose; data: unknown }) =>
  pathInWorld((n.data as { path: PolygonPath }).path, n.pose) as PolygonPath;

describe('regenerateShape', () => {
  it('makes the shape again from new parameters, keeping the rest of the data', () => {
    const next = regenerateShape(star(5), { kind: 'star', points: 7, innerRadiusRatio: 0.3, rotation: 0 })!;
    expect(shapeGeneratorOf(next.data)).toEqual({ kind: 'star', points: 7, innerRadiusRatio: 0.3, rotation: 0 });
    expect((next.data as { fill: string }).fill).toBe('red');
    expect(worldOf(next).coords.length).toBe(7 * 2 * 2);
  });

  it('changes nothing drawn when made again from the same parameters, in a box it was stretched to', () => {
    const before = star(5, -Math.PI / 2, { x: 0, y: 0, width: 300, height: 200 });
    const after = regenerateShape(before, before.data.generator)!;
    const a = vertices(worldOf(before));
    const b = vertices(worldOf(after));
    expect(b).toHaveLength(a.length);
    b.forEach((p, i) => {
      expect(p.x).toBeCloseTo(a[i].x, 3);
      expect(p.y).toBeCloseTo(a[i].y, 3);
    });
  });

  it('keeps a rotated shape where it was', () => {
    const before = star(4, 0, { rotation: Math.PI / 6 });
    const centerBefore = boundsOfPath(worldOf(before));
    const after = regenerateShape(before, { kind: 'star', points: 8, innerRadiusRatio: 0.5, rotation: 0 })!;
    expect(after.pose.rotation).toBe(Math.PI / 6);
    const centerAfter = boundsOfPath(worldOf(after));
    expect(centerAfter.x + centerAfter.width / 2).toBeCloseTo(centerBefore.x + centerBefore.width / 2, 3);
    expect(centerAfter.y + centerAfter.height / 2).toBeCloseTo(centerBefore.y + centerBefore.height / 2, 3);
    // Every outer point sits on the old circle: radius 50 about (100, 100).
    const outer = vertices(worldOf(after)).filter((_, i) => i % 2 === 0);
    for (const p of outer) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(50, 3);
  });

  it('refuses a node whose path no longer matches its generator', () => {
    const edited = star(5);
    const path = edited.data.path;
    const coords = new Float32Array(path.coords);
    coords[2] += 7;
    edited.data.path = { ...path, coords } as PolygonPath;
    expect(regenerateShape(edited, { kind: 'star', points: 6, innerRadiusRatio: 0.5, rotation: 0 })).toBeNull();
  });

  it('holds counts to whole numbers in range', () => {
    const next = regenerateShape(
      { pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: regularPolygonPath({ x: 5, y: 5 }, 5, 6), generator: { kind: 'polygon', sides: 6, rotation: 0 } } },
      { kind: 'polygon', sides: 2.4, rotation: 0 },
    )!;
    expect(shapeGeneratorOf(next.data)).toEqual({ kind: 'polygon', sides: 3, rotation: 0 });
  });
});

describe('settleShapeGenerator', () => {
  it('regenerates when a write changed the generator', () => {
    const prev = star(5);
    const written = { pose: prev.pose, data: { ...prev.data, generator: { ...prev.data.generator, points: 9 } } };
    const settled = settleShapeGenerator(written, prev);
    expect((settled.data as { path: PolygonPath }).path).toEqual(
      expect.objectContaining({ kind: 'polygon' }),
    );
    expect(worldOf(settled).coords.length).toBe(9 * 2 * 2);
  });

  it('stores any other write as made', () => {
    const prev = star(5);
    const written = { pose: prev.pose, data: { ...prev.data, fill: 'blue' } };
    expect(settleShapeGenerator(written, prev)).toBe(written);
  });

  it('drops a generator written onto a node that held none', () => {
    const prev = { pose: { x: 0, y: 0, width: 10, height: 10 }, data: { path: shapeGeneratorPath({ kind: 'polygon', sides: 5, rotation: 0 }) } };
    const written = { pose: prev.pose, data: { ...prev.data, generator: { points: 7 } } };
    expect(settleShapeGenerator(written, prev).data).toEqual(prev.data);
  });

  it('drops the generator of a shape whose path was edited', () => {
    const prev = star(5);
    const coords = new Float32Array(prev.data.path.coords);
    coords[0] -= 3;
    prev.data.path = { ...prev.data.path, coords } as PolygonPath;
    const written = { pose: prev.pose, data: { ...prev.data, generator: { ...prev.data.generator, points: 6 } } };
    const settled = settleShapeGenerator(written, prev);
    expect(settled.data).toEqual(withoutShapeGenerator(prev.data));
  });
});
