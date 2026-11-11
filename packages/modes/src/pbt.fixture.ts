/**
 * fast-check helpers shared by modes' property tests: run counts, tally guards, and mode lists over a small pool
 * of ids and tags, ids named like `Object.prototype` members included. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { ModeDefinition } from './modeDefinition';

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
      if (globalThis.process?.env?.PBT_TALLY) console.warn(`tally ${what}: ${seen.get(what) ?? 0} (wants ${n})`);
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

export const MODE_IDS = ['normal', 'path-edit', 'crop', '__proto__', 'constructor', ''] as const;
export const TAGS = ['navigation', 'creates-paths', 'edits-anchors', 'applies-fill', 'app:custom', 'toString'] as const;
export const NODE_IDS = ['a', 'b', 'c', '__proto__'] as const;

export const tag = fc.constantFrom(...TAGS);
export const tags = fc.array(tag, { maxLength: 3 });

/** One to four modes with distinct ids, each allowing a few tags, some scoping. */
export const modes: fc.Arbitrary<ModeDefinition[]> = fc.uniqueArray(fc.constantFrom(...MODE_IDS), { minLength: 1, maxLength: 4 })
  .chain((ids) => fc.tuple(...ids.map((id) => fc.record({
    id: fc.constant(id),
    kind: fc.constantFrom<'soft' | 'strict'>('soft', 'strict'),
    allows: fc.uniqueArray(tag, { maxLength: 3 }),
    scoping: fc.boolean(),
  }))));
