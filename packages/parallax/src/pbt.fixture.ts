/**
 * fast-check arbitraries shared by parallax's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { DrawCommand, RenderLayer, View } from '@weasel-js/core';

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
export function coord(limit = 1e4): fc.Arbitrary<number> {
  return fc.double({ min: -limit, max: limit, noNaN: true, noDefaultInfinity: true });
}

/** A period: positive, from a hair to a continent. */
export const period = fc.oneof(
  fc.double({ min: 1e-3, max: 1e6, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: 1, max: 2000 }),
);

/** A zoom magnitude a canvas can be at, either sign. */
export const zoom = fc.tuple(fc.double({ min: 0.05, max: 20, noNaN: true }), fc.boolean())
  .map(([z, flip]) => (flip ? -z : z));

/** A view at a finite position and zoom. */
export const view: fc.Arbitrary<View> = fc.record({ x: coord(1e6), y: coord(1e6), sx: zoom, sy: zoom })
  .map(({ x, y, sx, sy }) => ({ x, y, scale: { x: sx, y: sy } }));

/** A canvas size in CSS px. */
export const dims = fc.record({ width: fc.integer({ min: 1, max: 2000 }), height: fc.integer({ min: 1, max: 2000 }), dpr: fc.constant(1) });

/** A world source that records the view each copy hands it and draws one rect. */
export function recordingSource(space: 'world' | 'screen' = 'world'): { layer: RenderLayer<unknown>; views: View[] } {
  const views: View[] = [];
  const layer: RenderLayer<unknown> = {
    id: `src-${space}`, label: 'src', space,
    draw: (_d, v) => { views.push(v); return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } } as DrawCommand]; },
  };
  return { layer, views };
}

/** A copy's world offset: `[6]` and `[7]` of its column-major transform. */
export function offsetOf(cmd: DrawCommand): [number, number] {
  const t = (cmd as { transform?: ArrayLike<number> }).transform;
  return t ? [t[6]!, t[7]!] : [0, 0];
}

/** Every number in `cmds` that is not finite, with where it sits. */
export function nonFinite(value: unknown, at = ''): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [`${at}=${value}`];
  if (value === null || typeof value !== 'object') return [];
  if (ArrayBuffer.isView(value)) return nonFinite(Array.from(value as unknown as ArrayLike<number>), at);
  return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${at}.${k}`));
}
