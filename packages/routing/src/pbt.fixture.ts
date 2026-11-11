/**
 * fast-check helpers shared by routing's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { expect } from 'vitest';
import type { ModSpec } from '@weasel-js/gestures';

/** `numRuns` for a property: `n` locally, `WEASEL_PBT_RUNS` on a deep run. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Counts named outcomes across a property's runs, so one that exercised nothing fails. */
export function tally() {
  const counts = new Map<string, number>();
  return {
    hit(name: string): void { counts.set(name, (counts.get(name) ?? 0) + 1); },
    /** Every name was hit at least once. */
    expectHit(...names: string[]): void {
      for (const name of names) expect(counts.get(name) ?? 0, `never hit: ${name}`).toBeGreaterThan(0);
    },
  };
}

export interface KeyEvent { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }

/** Every modifier state on a keystroke of `key`. */
export function keyEvents(key: string): KeyEvent[] {
  return Array.from({ length: 16 }, (_, i) => ({
    key, altKey: (i & 1) !== 0, ctrlKey: (i & 2) !== 0, metaKey: (i & 4) !== 0, shiftKey: (i & 8) !== 0,
  }));
}

const modValue = fc.constantFrom<boolean | 'optional' | undefined>(undefined, true, false, 'optional');

/** A `ModSpec` over every field, `mod` included, each absent, required, forbidden, or optional. */
export const modSpec: fc.Arbitrary<Partial<ModSpec> | undefined> = fc.option(
  fc.record({ alt: modValue, ctrl: modValue, meta: modValue, shift: modValue, mod: modValue })
    .map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as Partial<ModSpec>),
  { nil: undefined },
);
