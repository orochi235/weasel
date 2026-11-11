/**
 * fast-check arbitraries and a headless scene and animator shared by d3's property tests. Test-only: nothing in
 * the package imports it.
 */
import fc from 'fast-check';
import { createScene, type Scene } from '@weasel-js/core';
import { hostAnimator, type Animator } from '@weasel-js/animator';

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

export interface Pose { x: number; y: number; width: number; height: number }
export type Payload = Record<string, unknown>;
export type TestScene = Scene<Payload, 'graph' | 'other', Pose>;

/** A scene with a `graph` layer, which a binding enters by default, and an `other` one. */
export function makeScene(): TestScene {
  return createScene<Payload, 'graph' | 'other', Pose>({ systemLayers: [{ id: 'graph' }, { id: 'other' }] });
}

/** An animator on a clock the test moves by hand. */
export function makeAnimator(): { animator: Animator; advance(ms: number): void; dispose(): void } {
  let now = 0;
  let wanted = false;
  const hosted = hostAnimator({ now: () => now, requestFrame: () => { wanted = true; }, cancelFrame: () => { wanted = false; } });
  return {
    animator: hosted.animator,
    advance(ms) {
      now += ms;
      if (!wanted) return;
      wanted = false;
      hosted.tick(now);
    },
    dispose: () => hosted.dispose(),
  };
}

/** A finite coordinate, often a short decimal that does not sit on a binary fraction. */
export const num = fc.oneof(
  fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -1000, max: 1000 }).map((n) => n / 10),
);

export const pose: fc.Arbitrary<Pose> = fc.record({ x: num, y: num, width: num.map(Math.abs), height: num.map(Math.abs) });

/** Keys from a small alphabet, so joins share, drop, and bring back nodes; with prototype names among them. */
export const key = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '__proto__', 'constructor', 'toString');
