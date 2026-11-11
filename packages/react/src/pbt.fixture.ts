/**
 * Helpers shared by react's property tests. Test-only: nothing in the package imports it.
 */

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Counts of named cases, for guards that fail a property whose inputs never reached a case. */
export function tally(): { add(name: string): void; get(name: string): number } {
  const counts = new Map<string, number>();
  return {
    add: (name) => { counts.set(name, (counts.get(name) ?? 0) + 1); },
    get: (name) => counts.get(name) ?? 0,
  };
}
