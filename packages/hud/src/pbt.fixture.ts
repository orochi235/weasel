/**
 * fast-check arbitraries shared by hud's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { MenuController, MenuEntry } from '@weasel-js/menu';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Counts named cases, so a property whose inputs never reach a case fails rather than passes. */
export function tally(): { hit(name: string): void; atLeast(name: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    hit: (name) => { seen.set(name, (seen.get(name) ?? 0) + 1); },
    atLeast: (name, n) => {
      const got = seen.get(name) ?? 0;
      if (got < n) throw new Error(`tally: "${name}" came up ${got} times, under ${n} (${JSON.stringify([...seen])})`);
    },
  };
}

/**
 * Grapheme clusters a text row can hold: letters, a digit, space and punctuation, a letter with its mark, a lone
 * mark, an emoji with a skin tone, a flag, a keycap, a family sequence, and clusters that mix word and non-word code
 * points (a letter carrying a skin tone, a letter before a joiner).
 */
export const GRAPHEMES = [
  'a', 'b', 'Z', '9', '_', ' ', '.', '-', 'ß', 'é', '́', '👍🏽', '🇯🇵', '1️⃣', '👨‍👩‍👧', 'a🏽', 'x‍', '😀',
] as const;

export const grapheme = fc.constantFrom(...GRAPHEMES);

/** A short run of {@link GRAPHEMES}, joined. */
export const draftText = fc.array(grapheme, { maxLength: 8 }).map((g) => g.join(''));

/** A finite coordinate, mostly on a pixel grid. */
export const coord = fc.oneof(
  fc.integer({ min: -2000, max: 2000 }),
  fc.double({ min: -2000, max: 2000, noNaN: true, noDefaultInfinity: true }),
);

/** A finite non-negative length. */
export const length = (max = 1000) => fc.oneof(
  fc.integer({ min: 0, max }),
  fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true }),
);

/** A label up to 30 characters of plain text. */
export const label = fc.string({ maxLength: 30 });

const noop = () => {};

/** One menu level of up to `max` entries: items (checkable, radio, disabled, described), separators, number, text
 *  and color rows, and, while `depth` lasts, submenus with levels of their own. Keys are unique within a level. */
export function menuLevel(depth: number, max = 8): fc.Arbitrary<MenuEntry[]> {
  const leaf = fc.oneof(
    fc.record({
      kind: fc.constant('item' as const), label, disabled: fc.boolean(), checked: fc.option(fc.boolean(), { nil: undefined }),
      radio: fc.option(fc.constant(true as const), { nil: undefined }), description: fc.option(label, { nil: undefined }),
      disabledReason: fc.option(label, { nil: undefined }),
    }).map((e) => ({ ...e, run: noop })),
    fc.constant({ kind: 'separator' as const }),
    fc.record({
      kind: fc.constant('number' as const), label, disabled: fc.boolean(),
      value: fc.option(fc.integer({ min: -50, max: 50 }), { nil: undefined }),
      min: fc.option(fc.constant(-20), { nil: undefined }), max: fc.option(fc.constant(20), { nil: undefined }),
    }).map((e) => ({ ...e, set: noop })),
    fc.record({ kind: fc.constant('text' as const), label, disabled: fc.boolean(), value: fc.option(label, { nil: undefined }) })
      .map((e) => ({ ...e, set: noop })),
    fc.record({ kind: fc.constant('color' as const), label, disabled: fc.boolean(), value: fc.option(fc.constantFrom('#ff0000', '#00ff0080'), { nil: undefined }) }),
  );
  const entry: fc.Arbitrary<Omit<MenuEntry, 'key'>> = depth <= 0 ? leaf : fc.oneof(
    { arbitrary: leaf, weight: 3 },
    { arbitrary: fc.record({ kind: fc.constant('submenu' as const), label, disabled: fc.boolean(), entries: menuLevel(depth - 1, max) }), weight: 2 },
  );
  return fc.array(entry, { minLength: 1, maxLength: max })
    .map((es) => es.map((e, i) => ({ ...e, key: `k${i}` }) as MenuEntry));
}

/** Open `c` along `path`, each step pressing the `n`th enabled submenu row of the deepest open level (mod how many
 *  there are), and stopping where a level has none. */
export function openPath(c: MenuController, path: readonly number[]): void {
  for (const n of path) {
    const level = c.stack().length - 1;
    const subs = c.entriesAt(level).flatMap((e, i) => (e.kind === 'submenu' && !e.disabled ? [i] : []));
    if (subs.length === 0) return;
    c.press(level, subs[n % subs.length]!);
  }
}
