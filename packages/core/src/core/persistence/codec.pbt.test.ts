/**
 * Property tests of the snapshot codec: any data, typed arrays and lookalikes of what the writer tags anywhere in it,
 * reads back equal through `stringifySnapshot` and `parseSnapshot`, and a path an older save wrote untagged reads as
 * typed arrays.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { decodeSnapshot, parseSnapshot, stringifySnapshot } from './codec';
import { dataValue, same } from './pbt.fixture';

const RUNS = 300;

const hop = (v: unknown): unknown => parseSnapshot(stringifySnapshot(v));

describe('the snapshot codec', () => {
  it('read back whatever they write, at any depth, under any key', () => {
    const seen = tally();
    fc.assert(fc.property(dataValue, (v) => {
      const text = stringifySnapshot(v);
      if (/"__ta"|"commands"|"coords"|"__raw"/.test(text)) seen.count('lookalike or tagged');
      expect(same(hop(v), v)).toEqual([]);
    }), runs(RUNS));
    seen.atLeast('lookalike or tagged', RUNS / 3);
  }, timeoutFor(RUNS, 5));

  it('still read a path an older save wrote untagged', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 5 }), fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { maxLength: 5 }), fc.boolean(),
      (cmds, coords, asObject) => {
        const legacy = (a: number[]) => (asObject ? Object.fromEntries(a.map((n, i) => [String(i), n])) : a);
        const got = decodeSnapshot(JSON.parse(JSON.stringify({ path: { commands: legacy(cmds), coords: legacy(coords) } }))) as { path: { commands: Uint8Array; coords: Float32Array } };
        expect(same(got.path.commands, Uint8Array.from(cmds))).toEqual([]);
        expect(same(got.path.coords, Float32Array.from(coords))).toEqual([]);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});
