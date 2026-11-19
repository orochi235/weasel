/** `parseColor` on very long text: it reads a color or throws its own error, in time linear in the text. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { parseColor } from './color';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

function read(text: string): 'read' | 'refused' {
  try {
    parseColor(text);
    return 'read';
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('parseColor: ')) return 'refused';
    throw err;
  }
}

describe('parseColor on very long text, property', () => {
  it('reads or refuses in bounded time', () => {
    const wrap = (run: string) => fc.constantFrom(run, `rgb(${run} 0 0)`, `hsl(0 ${run} 50%)`, `#${run}`, `oklch(${run})`);
    fc.assert(fc.property(longText().chain(wrap), (text) => {
      quick(() => read(text));
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('parseColor on very long text, shrunk counterexamples', () => {
  it('refuses a channel of a long run of digits ending in junk, in linear time', () => {
    expect(quick(() => read(`rgb(${'1'.repeat(LONG)}! 0 0)`))).toBe('refused');
  });
});
