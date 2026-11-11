/**
 * fast-check arbitraries shared by icons' property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { IconGlyph } from './table';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Names that collide with `Object.prototype` members, which every map keyed by name must treat as plain keys. */
export const PROTO_NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'] as const;

/** One half of a qualified name: no colon, no whitespace, not empty. */
export const part: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('core', 'ui', 'undo', 'shape-tools', 'é', '😀', ...PROTO_NAMES),
  fc.string({ unit: 'grapheme', minLength: 1, maxLength: 8 }).filter((s) => !/[:\s]/.test(s)),
);

/** Any short string, colons and whitespace weighted in. */
export const anyText: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.array(fc.constantFrom('a', ':', ' ', '\n', ' ', ' ', 'é', '😀', '\t', ''), { maxLength: 6 }).map((a) => a.join('')),
  fc.tuple(part, part).map(([a, b]) => `${a}:${b}`),
);

export const glyph = (body: string, group = 'Test'): IconGlyph => ({ body, group, tags: [] });
