/** `edgeIdOf`: two id-less edges get one id exactly when their ends, ports, and labels all agree. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DataEdge } from './dataTypes';
import { edgeIdOf } from './edgeId';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 2000;

/** Text built from the separators an id uses, so a collision has every chance. */
const text = fc.array(fc.constantFrom('a', 'b', '.', '>', '-', ':', '/', '\\', 'edge', '->', ' '), { maxLength: 4 }).map((s) => s.join(''));
const opt = fc.option(text, { nil: undefined });
const edge: fc.Arbitrary<DataEdge> = fc.record({ from: text, to: text, fromPort: opt, toPort: opt, label: opt })
  .map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) as unknown as DataEdge);

const key = (e: DataEdge) => JSON.stringify([e.from, e.fromPort ?? null, e.to, e.toPort ?? null, e.label ?? null]);

describe('edgeIdOf', () => {
  it('gives id-less edges the same id exactly when they agree', () => {
    const seen = tally();
    fc.assert(fc.property(edge, edge, (a, b) => {
      const same = key(a) === key(b);
      seen.count(same ? 'same' : 'apart');
      expect(edgeIdOf(a) === edgeIdOf(b)).toBe(same);
      expect(edgeIdOf({ ...a })).toBe(edgeIdOf(a));
    }), runs(RUNS));
    seen.atLeast('apart', RUNS / 2);
  }, timeoutFor(RUNS, 0.2));

  it('keeps ids apart across a set of edges differing in one field', () => {
    fc.assert(fc.property(fc.uniqueArray(edge, { selector: key, maxLength: 20 }), (edges) => {
      expect(new Set(edges.map(edgeIdOf)).size).toBe(edges.length);
    }), runs(RUNS / 10));
  }, timeoutFor(RUNS / 10, 1));

  it('answers an authored id as it is', () => {
    fc.assert(fc.property(edge, text, (e, id) => {
      expect(edgeIdOf({ ...e, id })).toBe(id);
    }), runs(RUNS / 10));
  }, timeoutFor(RUNS / 10, 1));
});
