/** The theme's readers of CSS numbers on very long text answer in time linear in the text, never throwing. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { readCssNumber } from './cssNumber';
import { resolveCurrentColor } from './currentColor';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

/** `resolveCurrentColor`'s answer, or `null` where it throws its own error for a form it does not flatten. */
function resolved(text: string): string | null {
  try {
    return resolveCurrentColor(text, '#102030');
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('resolveCurrentColor: ')) return null;
    throw err;
  }
}

describe('theme number readers on very long text, property', () => {
  it('readCssNumber answers in bounded time', () => {
    fc.assert(fc.property(longText(), (text) => {
      quick(() => readCssNumber(text));
    }), { numRuns: RUNS });
  }, TIMEOUT);

  it('resolveCurrentColor answers in bounded time', () => {
    const wrapped = longText().chain((run) =>
      fc.constantFrom(`rgb(from currentcolor r g b / ${run})`, `color-mix(in srgb, currentcolor ${run}, transparent)`));
    fc.assert(fc.property(wrapped, (text) => {
      quick(() => resolved(text));
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('theme number readers on very long text, shrunk counterexamples', () => {
  const digits = `${'1'.repeat(LONG)}!`;

  it('reads a long run of digits ending in junk as no number, in linear time', () => {
    expect(quick(() => readCssNumber(digits))).toBeUndefined();
  });

  it('refuses a currentColor mix of a long run of digits, in linear time', () => {
    const text = `rgb(from currentcolor r g b / ${digits})`;
    expect(quick(() => resolved(text))).toBeNull();
  });
});
