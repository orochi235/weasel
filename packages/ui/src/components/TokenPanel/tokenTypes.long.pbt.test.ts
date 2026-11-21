/** The token panel's readers of a token's value answer in time linear in the text, on very long values. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { bezierPoints, inferTokenType, splitUnit } from './tokenTypes';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

describe('token value readers on very long text, property', () => {
  it('inferTokenType, splitUnit and bezierPoints answer in bounded time', () => {
    const value = longText().chain((run) => fc.constantFrom(run, `cubic-bezier(${run}, 0, 0, 1)`, `${run}px`));
    fc.assert(fc.property(value, (text) => {
      expect(typeof quick(() => inferTokenType(text))).toBe('string');
      quick(() => splitUnit(text));
      quick(() => bezierPoints(text));
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('token value readers on very long text, shrunk counterexamples', () => {
  it('types a long run of digits ending in junk in linear time', () => {
    quick(() => inferTokenType(`${'1'.repeat(LONG)}!`));
  });

  it('types a long run of brackets or parentheses without overflowing the stack', () => {
    expect(quick(() => inferTokenType('['.repeat(LONG)))).toBe('string');
    expect(quick(() => inferTokenType(`rgb${'('.repeat(LONG)}`))).toBe('string');
  });

  it('types a long run of commas in linear time', () => {
    expect(quick(() => inferTokenType(','.repeat(LONG)))).toBe('string');
  });
});
