/**
 * `fromDtcg` as a fuzz target: a DTCG document is JSON from a design tool. Junk, and an exported theme with one field
 * dropped, duplicated or retyped, either load or are refused with an `Error` saying what is wrong; never a
 * `TypeError` from reading a field that was not there, and nothing reaches `Object.prototype`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { junk, mutated, prototypePolluted } from '@weasel-js/registry/testing/hostile.fixture';
import { fromDtcg, type DtcgDocument } from './fromDtcg';
import { toDtcg } from './engine/emit/dtcg';
import { weaselTheme } from './theme';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const VALID = JSON.parse(JSON.stringify({ ...toDtcg(weaselTheme), name: 'exported' })) as unknown;

const ENGINE_ERRORS = [TypeError, RangeError, ReferenceError];

function load(doc: unknown): 'read' | 'refused' {
  try {
    fromDtcg(doc as DtcgDocument);
    return 'read';
  } catch (err) {
    if (err instanceof Error && !ENGINE_ERRORS.some((E) => err instanceof E)) return 'refused';
    throw err;
  } finally {
    expect(prototypePolluted()).toBe(false);
  }
}

describe('fromDtcg as a fuzz target', () => {
  it('reads an exported theme', () => {
    expect(load(VALID)).toBe('read');
  });

  it('refuses junk with an error that says what is wrong', () => {
    fc.assert(fc.property(fc.oneof(junk, junk.map((j) => ({ name: 'x', $extensions: j })), junk.map((j) => ({ name: 'x', modes: j, primitives: j }))), (doc) => {
      load(doc);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));

  it('loads or refuses an exported theme with one field dropped, duplicated or retyped', () => {
    fc.assert(fc.property(mutated(fc.constant(VALID)), ({ value }) => {
      load(value);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 20));
});

describe('fromDtcg as a fuzz target, shrunk counterexamples', () => {
  it.each([null, undefined, 5, 'theme'])('refuses %s with the error it gives a document with no name', (doc) => {
    expect(() => fromDtcg(doc as unknown as DtcgDocument)).toThrow('DTCG document needs a string "name"');
  });
});
