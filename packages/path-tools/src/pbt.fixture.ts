/**
 * fast-check arbitraries and checks shared by path-tools' property tests. Test-only: nothing in the package imports it.
 */
import { expect } from 'vitest';
import fc from 'fast-check';
import {
  anchorsToPath, PATH_C, PATH_CMD_LENGTHS, PATH_L, PATH_M, PATH_Q, PATH_Z, worldCoords, type PenAnchor, type PolygonPath,
} from '@weasel-js/geom';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(10_000, runs(n).numRuns * msPerRun);
}

/** A tally of what a property's runs exercised, for guards that fail a property which exercised nothing. */
export function tally() {
  const counts = new Map<string, number>();
  return {
    count: (k: string): void => { counts.set(k, (counts.get(k) ?? 0) + 1); },
    get: (k: string): number => counts.get(k) ?? 0,
    toString: (): string => JSON.stringify([...counts]),
  };
}

const at = fc.integer({ min: -200, max: 200 });

/** An anchor on the integer grid, a corner or with handles, mirrored or not. */
export const anchor: fc.Arbitrary<PenAnchor> = fc.tuple(at, at, fc.option(fc.tuple(at, at), { nil: undefined }), fc.boolean())
  .map(([x, y, h, mirrored]) => (h
    ? { x, y, outHandle: { x: x + h[0] / 4, y: y + h[1] / 4 }, inHandle: mirrored ? { x: x - h[0] / 4, y: y - h[1] / 4 } : { x: x + h[1] / 5, y: y - h[0] / 5 } }
    : { x, y }));

/** One or two subpaths of two to six anchors, each open or closed; repeated anchors and zero-length segments included. */
export const penPath: fc.Arbitrary<PolygonPath> = fc.array(
  fc.tuple(fc.array(anchor, { minLength: 2, maxLength: 6 }), fc.boolean()), { minLength: 1, maxLength: 2 },
).map((subs) => anchorsToPath(subs.map(([a]) => a), subs.map(([, c]) => c)));

/** A world point in and around where {@link penPath} draws. */
export const point = fc.record({ x: fc.integer({ min: -260, max: 260 }), y: fc.integer({ min: -260, max: 260 }) });

/** What a path compares as: its commands, world coords, and corner specs. */
export const snap = (p: PolygonPath) => ({ commands: Array.from(p.commands), coords: Array.from(worldCoords(p)), corners: p.corners ?? null });

/** Well formed: each subpath opens with M and draws something before a Z, coords match the commands, all finite. */
export function checkPath(p: PolygonPath): void {
  const cmds = Array.from(p.commands);
  let need = 0;
  let drawn = false;
  cmds.forEach((c, i) => {
    need += PATH_CMD_LENGTHS[c]!;
    if (i === 0) expect(c, 'the path opens with a moveto').toBe(PATH_M);
    if (c === PATH_M) {
      expect(cmds[i + 1], `a moveto at ${i} is followed by something`).not.toBeUndefined();
      expect(cmds[i + 1], `no empty subpath at ${i}`).not.toBe(PATH_M);
      drawn = false;
    } else if (c === PATH_Z) {
      expect(drawn, `a close at ${i} closes a subpath that drew something`).toBe(true);
    } else {
      expect([PATH_L, PATH_C, PATH_Q]).toContain(c);
      drawn = true;
    }
  });
  expect(p.coords.length).toBe(need);
  for (const v of worldCoords(p)) expect(Number.isFinite(v)).toBe(true);
}

/** One open or closed subpath of many anchors close to a line or an arc: most of them redundant, which a simplifier needs. */
export const densePath: fc.Arbitrary<PolygonPath> = fc.record({
  n: fc.integer({ min: 6, max: 16 }),
  step: fc.integer({ min: 2, max: 20 }),
  bend: fc.integer({ min: -3, max: 3 }),
  jitter: fc.array(fc.integer({ min: -1, max: 1 }), { minLength: 16, maxLength: 16 }),
  closed: fc.boolean(),
}).map(({ n, step, bend, jitter, closed }) => anchorsToPath([Array.from({ length: n }, (_, i) => ({
  x: i * step - 100, y: bend * ((i - n / 2) ** 2) / 4 + jitter[i]! / 4,
}))], [closed]));
