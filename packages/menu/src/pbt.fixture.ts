/**
 * fast-check helpers shared by menu's property tests: run counts, tally guards, and random menus. Test-only:
 * nothing in the package imports it.
 */
import fc from 'fast-check';
import type { MenuEntry } from './entries';

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

let keyCount = 0;
const label = fc.constantFrom('Apple', 'apricot', 'Banana', 'berry', 'Cherry', '2nd', 'Ápex', 'Ɑlpha');
const access = fc.constantFrom(undefined, undefined, 'a', 'B', 'c', 'ä');
const flag = fc.constantFrom(undefined, undefined, undefined, true as const);
/** Items mostly kept open, so choosing one leaves the menu open more often than not. */
const holds = fc.constantFrom(undefined, true as const, true as const, true as const, true as const);
const strip = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Menus of items (enabled, disabled, mostly kept open), separators, submenus (enabled, disabled, empty), and
 *  number and text rows, with access letters and labels sharing first letters. */
export const entries: fc.Arbitrary<MenuEntry[]> = fc.letrec((tie) => ({
  entry: fc.oneof(
    { weight: 5, arbitrary: fc.record({ label, access, disabled: flag, keepOpen: holds }).map((x): MenuEntry => ({ kind: 'item', key: `i${keyCount++}`, ...strip(x), run: () => {} })) },
    { weight: 2, arbitrary: fc.constant(null).map((): MenuEntry => ({ kind: 'separator', key: `s${keyCount++}` })) },
    { weight: 4, arbitrary: fc.record({ label, access, disabled: flag, entries: tie('list') as fc.Arbitrary<MenuEntry[]> }).map((x): MenuEntry => ({ kind: 'submenu', key: `m${keyCount++}`, ...strip(x) })) },
    { weight: 2, arbitrary: fc.record({ label, access, disabled: flag, value: fc.option(fc.integer({ min: -3, max: 3 }), { nil: undefined }), min: fc.constantFrom(undefined, -2), max: fc.constantFrom(undefined, 2) })
      .map((x): MenuEntry => ({ kind: 'number', key: `n${keyCount++}`, ...strip(x), value: x.value, set: () => {} })) },
    { weight: 1, arbitrary: fc.record({ label, access, disabled: flag }).map((x): MenuEntry => ({ kind: 'text', key: `t${keyCount++}`, ...strip(x), value: '', set: () => {} })) },
  ),
  list: fc.array(tie('entry') as fc.Arbitrary<MenuEntry>, { maxLength: 4, depthIdentifier: 'menu' }),
})).list as fc.Arbitrary<MenuEntry[]>;
