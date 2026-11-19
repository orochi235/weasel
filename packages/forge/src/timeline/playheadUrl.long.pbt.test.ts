/** `parseSeconds` on a very long URL parameter answers ms or `null` in time linear in the text. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { parseSeconds } from './playheadUrl';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

describe('parseSeconds on very long text, property', () => {
  it('answers in bounded time', () => {
    fc.assert(fc.property(longText(), (text) => {
      const got = quick(() => parseSeconds(text));
      expect(got === null || Number.isFinite(got)).toBe(true);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('parseSeconds on very long text, shrunk counterexamples', () => {
  it('reads a long run of digits ending in junk as null, in linear time', () => {
    expect(quick(() => parseSeconds(`${'0'.repeat(LONG)}!`))).toBeNull();
  });
});
