/**
 * fast-check arbitraries shared by kernel3d's property tests: vectors, rotations, poses, cameras, and viewports.
 * Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { len, quatFromAxisAngle, type Quat, type Vec3 } from '@weasel-js/geom/3d';
import { createCamera, MAX_PITCH, type Camera3d } from './camera';
import type { Pose3 } from './pose3';
import type { Viewport3d } from './project';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** A finite double in `±limit`. */
export function coord(limit = 100): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

export function v3(limit = 100): fc.Arbitrary<Vec3> {
  return fc.tuple(coord(limit), coord(limit), coord(limit)).map(([x, y, z]) => ({ x, y, z }));
}

/** A direction, not necessarily unit length, kept clear of zero. */
export const direction: fc.Arbitrary<Vec3> = v3(1).filter((v) => len(v) > 1e-2);

/** A unit rotation, the identity now and then. */
export const quat: fc.Arbitrary<Quat> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<Quat>([0, 0, 0, 1]) },
  { weight: 6, arbitrary: fc.tuple(direction, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true })).map(([a, t]) => quatFromAxisAngle(a, t)) },
);

/** A scale factor away from zero, either sign. */
export const factor: fc.Arbitrary<number> = fc.tuple(fc.double({ min: 0.1, max: 10, noNaN: true }), fc.boolean())
  .map(([s, neg]) => (neg ? -s : s));

export const scale3: fc.Arbitrary<Vec3> = fc.tuple(factor, factor, factor).map(([x, y, z]) => ({ x, y, z }));
export const uniformScale3: fc.Arbitrary<Vec3> = factor.map((s) => ({ x: s, y: s, z: s }));

export function pose(scale: fc.Arbitrary<Vec3> = scale3, limit = 50): fc.Arbitrary<Pose3> {
  return fc.record({ position: v3(limit), rotation: quat, scale });
}

/** An orbit camera inside the default limits, looking at somewhere near the origin. */
export const camera: fc.Arbitrary<Camera3d> = fc.record({
  target: v3(20),
  yaw: fc.double({ min: -2 * Math.PI, max: 2 * Math.PI, noNaN: true }),
  pitch: fc.double({ min: -MAX_PITCH, max: MAX_PITCH, noNaN: true }),
  distance: fc.double({ min: 0.5, max: 200, noNaN: true }),
  fov: fc.double({ min: 0.2, max: 2.5, noNaN: true }),
}).map((c) => createCamera(c));

/** A pane at least a few pixels a side, sometimes offset in the client. */
export const viewport: fc.Arbitrary<Viewport3d> = fc.record({
  camera,
  width: fc.integer({ min: 20, max: 2000 }),
  height: fc.integer({ min: 20, max: 2000 }),
  originX: fc.option(fc.integer({ min: -500, max: 500 }), { nil: undefined }),
  originY: fc.option(fc.integer({ min: -500, max: 500 }), { nil: undefined }),
}).map(({ originX, originY, ...vp }) => ({
  ...vp,
  ...(originX !== undefined ? { originX } : {}),
  ...(originY !== undefined ? { originY } : {}),
}));

/** A point inside `vp`'s pane, by its fractions across and down. */
export function paneFractions(): fc.Arbitrary<{ fx: number; fy: number }> {
  return fc.record({ fx: fc.double({ min: 0, max: 1, noNaN: true }), fy: fc.double({ min: 0, max: 1, noNaN: true }) });
}

export function paneAt(vp: Viewport3d, { fx, fy }: { fx: number; fy: number }): { x: number; y: number } {
  return { x: (vp.originX ?? 0) + fx * vp.width, y: (vp.originY ?? 0) + fy * vp.height };
}

export function maxDiff3(a: Vec3, b: Vec3): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

export function isFinite3(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
