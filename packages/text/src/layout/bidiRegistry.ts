/**
 * Where the bidi engine arrives. This package cannot import one (see
 * `bidiSeam.ts`), and most callers of `layoutRuns` are kit code a consumer
 * never touches, so the consumer registers it once and every layout finds it.
 */
import type { BidiResolver } from './bidiSeam';
import { isHardLineBreak } from './lineBreak/lineBreaks';
import type { TextDirection } from '../textStyle';

let registered: BidiResolver | null = null;

/**
 * Give every text layout a bidi engine: `registerBidi(bidi)`, with `bidi`
 * from `@weasel-js/bidi`. `layoutRuns` uses it whenever its options carry
 * none. Pass `null`, or call the function returned, to take it out again.
 */
export function registerBidi(engine: BidiResolver | null): () => void {
  registered = engine;
  return () => { if (registered === engine) registered = null; };
}

/** The engine {@link registerBidi} was last given, or null. */
export function registeredBidi(): BidiResolver | null {
  return registered;
}

/** Which way a paragraph reads, from an engine's base level for it. */
export function directionOfLevel(level: number): TextDirection {
  return level % 2 === 1 ? 'rtl' : 'ltr';
}

/**
 * The direction `text`'s first paragraph reads in: `direction` when it states
 * one, otherwise its first strong character's. Finding that takes an engine,
 * so with none registered the answer is `'ltr'`.
 */
export function paragraphDirection(
  text: string,
  direction: TextDirection | 'auto' = 'auto',
  engine: BidiResolver | null = registered,
): TextDirection {
  if (direction !== 'auto') return direction;
  if (engine === null) return 'ltr';
  const cps: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (isHardLineBreak(cp)) break;
    cps.push(cp);
  }
  return directionOfLevel(engine.baseLevel(engine.analyze(cps, 'auto')));
}

/**
 * Code point blocks whose letters read right-to-left.
 *
 * A heuristic on purpose: the real answer is `Bidi_Class`, which lives in
 * `@weasel-js/bidi` and is exactly what the caller has not installed when this
 * matters. It can miss a script, and it still counts a combining mark from
 * these blocks as a letter. What it leaves out is carved out below: code
 * points that sit in these blocks and read the same without an engine.
 */
const RTL_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0590, 0x05ff], [0x0600, 0x07bf], [0x0860, 0x08ff],
  [0xfb1d, 0xfdff], [0xfe70, 0xfeff],
  [0x10800, 0x10fff], [0x1e800, 0x1efff],
];

/** Digits and number signs inside those blocks. They keep their written order
 *  in any paragraph, so a string of them is laid out correctly as it is. */
const RTL_BLOCK_NUMBERS: ReadonlyArray<readonly [number, number]> = [
  [0x0600, 0x0605], [0x0660, 0x066c], [0x06dd, 0x06dd], [0x06f0, 0x06f9],
  [0x08e2, 0x08e2], [0x10d30, 0x10d39], [0x10e60, 0x10e7e],
];

/** The Arabic comma, the ornate parentheses, and the byte order mark: no
 *  direction of their own, so they take their neighbors'. */
const RTL_BLOCK_NEUTRALS: ReadonlyArray<readonly [number, number]> = [
  [0x060c, 0x060c], [0xfd3e, 0xfd3f], [0xfeff, 0xfeff],
];

function within(ranges: ReadonlyArray<readonly [number, number]>, cp: number): boolean {
  for (let i = 0; i < ranges.length; i++) if (cp >= ranges[i][0] && cp <= ranges[i][1]) return true;
  return false;
}

let warnedLogicalRtl = false;

/**
 * Warn, once per process, when `codePoints` hold right-to-left letters and
 * there is no engine to reorder them. `who` names the caller laying them out.
 */
export function warnRtlWithoutEngine(codePoints: ArrayLike<number>, who = 'weasel layoutRuns'): void {
  if (warnedLogicalRtl) return;
  for (let i = 0; i < codePoints.length; i++) {
    const cp = codePoints[i];
    if (!within(RTL_BLOCKS, cp) || within(RTL_BLOCK_NUMBERS, cp) || within(RTL_BLOCK_NEUTRALS, cp)) continue;
    warnedLogicalRtl = true;
    console.warn(
      // Naming the import in `from "<pkg>"` form would trip labkit's
      // consumer smoke test, which greps dist for that exact shape.
      `${who}: this text contains right-to-left characters but no ` +
      '`bidi` engine is registered, so it is being laid out in logical order — ' +
      'the glyphs will appear reversed. Import `bidi` out of the ' +
      '`@weasel-js/bidi` package and call `registerBidi(bidi)` once at startup.',
    );
    return;
  }
}

/** Test helper. Do not call from product code. */
export function _resetBidiWarningForTests(): void {
  warnedLogicalRtl = false;
}
