/**
 * fast-check arbitraries shared by text-dom's property tests, and a per-unit model of styled text to check runs
 * against. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { Fill } from '@weasel-js/paint';
import type { RunStylePatch, StyledRun } from '@weasel-js/text';

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

/** Characters with something to say: a surrogate pair, a combining mark, every hard break, a tab, spaces. */
export const CHARS = ['a', 'b', 'Z', ' ', '\t', 'é', '́', '😀', '\n', '\r', '\r\n', ' ', ' ', '\v', '\f', '\u0085', 'ß', 'ﬁ'];

/** Characters typed or pasted in an edit session: no hard breaks, which a caret holder would follow. */
export const TYPED = ['a', 'b', 'Z', ' ', 'é', '😀', 'ß'];

export const textOf = (chars: readonly string[], maxLength = 8): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...chars), { maxLength }).map((cs) => cs.join(''));

/** A CSS color as the browser serializes it back, so the overlay's round trip can compare strings. */
export const cssColor = fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255)).map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);

/** A color spelled any way a stored paint may spell it. */
export const anyColor = fc.oneof(
  cssColor,
  fc.constantFrom('#ff0000', '#abc', 'red', 'rgba(0, 0, 0, 0.5)', 'transparent', 'oklch(0.7 0.1 30)', 'not-a-color'),
);

export const fillArb: fc.Arbitrary<Fill | null> = fc.oneof(
  { weight: 3, arbitrary: anyColor.map((color): Fill => ({ paint: { kind: 'solid', color } })) },
  { weight: 1, arbitrary: anyColor.map((color): Fill => ({ paint: { color } })) },
  { weight: 1, arbitrary: fc.tuple(cssColor, fc.constantFrom(0, 0.25, 1)).map(([color, opacity]): Fill => ({ paint: { kind: 'solid', color, opacity } })) },
  { weight: 1, arbitrary: fc.constant<Fill>({ paint: { kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] } }) },
  { weight: 1, arbitrary: fc.constant<Fill>({}) },
  { weight: 1, arbitrary: fc.constant(null) },
);

/** A length as a run stores one: world units, or `{ px }`. */
const length = (lo: number, hi: number) => fc.oneof(
  fc.integer({ min: lo * 4, max: hi * 4 }).map((n) => n / 4),
  fc.integer({ min: lo * 4, max: hi * 4 }).map((n) => ({ px: n / 4 })),
);

/** Every styleable key a run carries, each drawn independently, flags only ever `true`. */
export const styleArb: fc.Arbitrary<RunStylePatch> = fc.record({
  bold: fc.constant(true),
  italic: fc.constant(true),
  underline: fc.constant(true),
  strikethrough: fc.constant(true),
  overline: fc.constant(true),
  fontWeight: fc.constantFrom(100, 300, 400, 550, 700, 900),
  fontFamily: fc.constantFrom('Georgia', 'Inter', 'Times New Roman', 'a "quoted" face'),
  fontSize: length(1, 200),
  fill: fillArb,
  stroke: fc.constant({ paint: { kind: 'solid' as const, color: '#00f' }, width: 2 }),
  letterSpacing: length(-10, 10),
  script: fc.constantFrom('super' as const, 'sub' as const),
  baselineShift: fc.integer({ min: -100, max: 100 }).map((n) => n / 20),
  fontScale: fc.integer({ min: 1, max: 4000 }).map((n) => n / 1000),
  textTransform: fc.constantFrom('none' as const, 'uppercase' as const, 'lowercase' as const, 'capitalize' as const),
  fontVariantCaps: fc.constantFrom('normal' as const, 'small-caps' as const),
  rotate: fc.integer({ min: -720, max: 720 }).map((n) => n / 2),
  lang: fc.constantFrom('en', 'tr', 'el', 'sr-Latn'),
}, { requiredKeys: [] });

export const runArb = (chars: readonly string[] = CHARS): fc.Arbitrary<StyledRun> =>
  fc.tuple(textOf(chars, 5), styleArb).map(([text, style]) => ({ text, ...style }));

/** Runs as a node may hold them: neighbors alike, empty runs, any key beside any other. */
export const runsArb = (chars: readonly string[] = CHARS): fc.Arbitrary<StyledRun[]> => fc.array(runArb(chars), { maxLength: 5 });

/** One code unit of text and the styling it carries. */
export interface Unit { ch: string; style: RunStylePatch }

const FLAGS = new Set(['bold', 'italic', 'underline', 'strikethrough', 'overline']);

/** `style` with flags stored only when on and nothing stored as `undefined`: the one form runs keep. */
export function canonical(style: RunStylePatch): RunStylePatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || (FLAGS.has(k) && v !== true)) continue;
    out[k] = v;
  }
  return out as RunStylePatch;
}

const keyOf = (style: RunStylePatch): string => JSON.stringify(Object.entries(canonical(style)).sort(([a], [b]) => (a < b ? -1 : 1)));

export const sameStyle = (a: RunStylePatch, b: RunStylePatch): boolean => keyOf(a) === keyOf(b);

export function toUnits(rs: readonly StyledRun[]): Unit[] {
  return rs.flatMap(({ text, ...style }) => [...text.split('')].map((ch) => ({ ch, style: canonical(style) })));
}

/** Units back to runs: neighbors alike merged, nothing empty. */
export function fromUnits(units: readonly Unit[]): StyledRun[] {
  const out: StyledRun[] = [];
  let lastKey = '';
  for (const u of units) {
    const key = keyOf(u.style);
    const last = out[out.length - 1];
    if (last && key === lastKey) last.text += u.ch;
    else { out.push({ text: u.ch, ...canonical(u.style) }); lastKey = key; }
  }
  return out;
}

/** `style` with `patch` written over it: `bold` and `fontWeight` each drop the other unless both are named. */
export function patched(style: RunStylePatch, patch: RunStylePatch): RunStylePatch {
  const out: Record<string, unknown> = { ...style };
  if ('bold' in patch && !('fontWeight' in patch)) delete out.fontWeight;
  if (patch.fontWeight !== undefined && !('bold' in patch)) delete out.bold;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === false) delete out[k];
    else out[k] = v;
  }
  return canonical(out as RunStylePatch);
}

/** Offsets in `text` that fall between code points. */
export function codePointStops(text: string): number[] {
  const stops = [0];
  let at = 0;
  for (const ch of text) { at += ch.length; stops.push(at); }
  return stops;
}
