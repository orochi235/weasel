/**
 * Helpers shared by the gestures package's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { EventModifiers } from './ui/inputEvent';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

export const NO_MODS: EventModifiers = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

/** Any of the 16 modifier states. */
export const modifiers: fc.Arbitrary<EventModifiers> = fc.record({
  altKey: fc.boolean(), ctrlKey: fc.boolean(), metaKey: fc.boolean(), shiftKey: fc.boolean(),
});

/** Every modifier state, for checks that sweep all of them rather than sample. */
export const ALL_MODIFIER_STATES: readonly EventModifiers[] = Array.from({ length: 16 }, (_, i) => ({
  altKey: (i & 1) !== 0, ctrlKey: (i & 2) !== 0, metaKey: (i & 4) !== 0, shiftKey: (i & 8) !== 0,
}));

/** A clock that only moves when told to, firing the timers it passes in the order they fall due, each at its own
 *  time. A timer cleared by an earlier one never fires, and one set by a callback fires if it falls in the step. */
export function fakeClock() {
  let t = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const nextDue = (until: number): [number, { at: number; fn: () => void }] | undefined => {
    let due: [number, { at: number; fn: () => void }] | undefined;
    for (const entry of timers) if (entry[1].at <= until && (!due || entry[1].at < due[1].at)) due = entry;
    return due;
  };
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => { timers.set(++seq, { at: t + ms, fn }); return seq; },
    clearTimer: (id: unknown) => { timers.delete(id as number); },
    advance(ms: number) {
      const until = t + ms;
      for (let due = nextDue(until); due; due = nextDue(until)) {
        timers.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].fn();
      }
      t = until;
    },
    pending: () => timers.size,
  };
}

/** Every numeric field of `value`, however deep, that is `NaN` or infinite, by path. */
export function nonFinite(value: unknown, path = ''): string[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => nonFinite(v, `${path}.${k}`));
}
