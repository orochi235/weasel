/**
 * The importer's readers of lengths on very long attribute text: each answers in time linear in the text, never
 * throwing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LONG, longText, quick } from '@weasel-js/registry/testing/hostile.fixture';
import { readProperty } from './properties';
import { mediaEnvironmentFor } from './media';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 40;
const TIMEOUT = Math.max(5_000, RUNS * 300);

function svgRoot(width: string): Element {
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.setAttribute('width', width);
  return root;
}

describe('svg length readers on very long text, property', () => {
  it('readProperty reads a length in bounded time', () => {
    fc.assert(fc.property(longText(), fc.constantFrom('stroke-width', 'font-size', 'letter-spacing', 'opacity'), (text, prop) => {
      quick(() => readProperty(prop as 'stroke-width', text));
    }), { numRuns: RUNS });
  }, TIMEOUT);

  it("mediaEnvironmentFor reads the root's width in bounded time", () => {
    fc.assert(fc.property(longText(), (text) => {
      expect(Number.isFinite(quick(() => mediaEnvironmentFor(svgRoot(text))).width)).toBe(true);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});

describe('svg length readers on very long text, shrunk counterexamples', () => {
  it('reads a long run of digits ending in junk as no length, in linear time', () => {
    expect(quick(() => readProperty('stroke-width', `${'1'.repeat(LONG)}!`))).toBeUndefined();
  });

  it('reads a root width of a length followed by a long run of spaces in linear time', () => {
    quick(() => mediaEnvironmentFor(svgRoot(`1${' '.repeat(LONG)}!`)));
  });
});
