/** `mermaidNumber` on a very long field answers a number or `undefined` in time linear in the text. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { mermaidNumber } from './number';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

describe('mermaidNumber on very long text, property', () => {
  it('answers in bounded time', () => {
    fc.assert(fc.property(longText(), (text) => {
      const got = quick(() => mermaidNumber(text));
      expect(got === undefined || Number.isFinite(got)).toBe(true);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('mermaidNumber on very long text, shrunk counterexamples', () => {
  it('reads a long run of digits ending in junk as undefined, in linear time', () => {
    expect(quick(() => mermaidNumber(`${'1'.repeat(LONG)}!`))).toBeUndefined();
  });
});
