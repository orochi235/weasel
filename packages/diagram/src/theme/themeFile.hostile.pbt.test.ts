/**
 * The diagram's readers of saved JSON as fuzz targets: `parseDiagramTheme` answers a theme or its list of errors for
 * any text, and `readEffectDoc` reads a document or throws an error saying what is wrong, never a `TypeError`;
 * neither reaches `Object.prototype`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { junk, prototypePolluted } from '@weasel-js/registry/testing/hostile.fixture';
import { parseDiagramTheme } from './themeFile';
import { readEffectDoc } from '../effect/docShape';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 300;
const TIMEOUT = Math.max(5_000, RUNS * 10);
const ENGINE_ERRORS = [TypeError, RangeError, ReferenceError];

describe('diagram JSON readers as fuzz targets', () => {
  it('parseDiagramTheme answers a theme or errors for any text', () => {
    const text = fc.oneof(fc.string(), fc.json(), junk.map((j) => JSON.stringify(j) ?? ''),
      junk.map((j) => JSON.stringify({ colors: j, fonts: j, edges: j, nodes: j }) ?? ''));
    fc.assert(fc.property(text, (t) => {
      const got = parseDiagramTheme(t);
      expect('theme' in got || ('errors' in got && got.errors.length > 0)).toBe(true);
      expect(prototypePolluted()).toBe(false);
    }), { numRuns: RUNS });
  }, TIMEOUT);

  it('readEffectDoc reads or refuses junk with an error saying what is wrong', () => {
    fc.assert(fc.property(fc.oneof(junk, junk.map((j) => ({ nodes: j, edges: j, clusters: j }))), (value) => {
      try {
        readEffectDoc(value);
      } catch (err) {
        if (!(err instanceof Error) || ENGINE_ERRORS.some((E) => err instanceof E)) throw err;
      }
      expect(prototypePolluted()).toBe(false);
    }), { numRuns: RUNS });
  }, TIMEOUT);
});
