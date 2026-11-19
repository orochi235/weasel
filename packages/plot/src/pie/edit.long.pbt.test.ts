/** `pieValueOf` on very long typed text answers a number or `null` in time linear in the text. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { pieValueOf } from './edit';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

describe('pieValueOf on very long text, property', () => {
  it('answers in bounded time', () => {
    fc.assert(fc.property(longText().chain((run) => fc.constantFrom(run, `[${run}`, `[${run}]`)), (text) => {
      const got = quick(() => pieValueOf(text));
      expect(got === null || Number.isFinite(got)).toBe(true);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('pieValueOf on very long text, shrunk counterexamples', () => {
  it('reads a long run of digits ending in junk as null, in linear time', () => {
    expect(quick(() => pieValueOf(`${'1'.repeat(LONG)}!`))).toBeNull();
  });

  it('reads an opening bracket and a long run of spaces as null, in linear time', () => {
    expect(quick(() => pieValueOf(`[${' '.repeat(LONG)}x`))).toBeNull();
  });

  it('still reads a value in brackets', () => {
    expect(pieValueOf(' [ 2.5 ] ')).toBe(2.5);
  });
});
