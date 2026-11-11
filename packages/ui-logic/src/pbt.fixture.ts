/**
 * fast-check helpers shared by ui-logic's property tests: run counts, tally guards, and a scheduler whose clock
 * moves only when told. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { Scheduler } from './scheduler';

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

/** A scheduler whose clock moves only when `advance` says, running due timers in time order. */
export function fakeScheduler(): { scheduler: Scheduler; advance(ms: number): void; pending(): number; now(): number } {
  let now = 0;
  let seq = 0;
  let timers: { at: number; seq: number; fn: () => void }[] = [];
  const scheduler: Scheduler = {
    now: () => now,
    set(fn, ms) {
      const t = { at: now + ms, seq: seq++, fn };
      timers.push(t);
      return () => { timers = timers.filter((x) => x !== t); };
    },
  };
  const advance = (ms: number): void => {
    const end = now + ms;
    for (;;) {
      const next = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
      if (!next) break;
      timers = timers.filter((t) => t !== next);
      now = next.at;
      next.fn();
    }
    now = end;
  };
  return { scheduler, advance, pending: () => timers.length, now: () => now };
}

/** Items of a list, some of which the highlight can't land on. */
export interface Item { label: string; stop: boolean }

const word = fc.constantFrom('apple', 'Apricot', 'banana', 'Blue', 'cherry', 'a', 'b', 'ab', 'Ab', '', 'éclair', 'Émile', '😀 smile', 'İzmir', 'İnci');

/** A list of items, short enough that every index comes up, some not stops. */
export const items: fc.Arbitrary<Item[]> = fc.array(
  fc.record({ label: word, stop: fc.oneof({ weight: 4, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }) }),
  { maxLength: 9 },
);

/** An index into a list of `n`, or null. */
export const at = (n: number): fc.Arbitrary<number | null> =>
  n === 0 ? fc.constant(null) : fc.option(fc.integer({ min: 0, max: n - 1 }), { nil: null });

/** A double spread evenly over `min..max`, ends included; `fc.double` crowds toward zero. */
export const uniform = (min: number, max: number): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 1 << 20 }).map((k) => (k === 1 << 20 ? max : min + ((max - min) * k) / (1 << 20)));
