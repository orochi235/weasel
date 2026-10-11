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
