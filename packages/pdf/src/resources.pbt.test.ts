/**
 * Stateful test of a page's resource names through any run of requests: the same request answers the
 * same name, different ones different names across ExtGStates and soft masks alike, and `/Resources`
 * holds exactly the names handed out, each naming what it was asked for.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PdfRef } from './objects';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { PageResources } from './resources';

const RUNS = 200;

type Ask =
  | { kind: 'gstate'; fill: number; stroke: number }
  | { kind: 'mask' | 'Shading' | 'XObject' | 'Font' | 'Pattern'; id: number };

const alpha = fc.oneof(fc.constantFrom(0, 1, 0.5, -0, 1e-7), fc.double({ min: 0, max: 1, noNaN: true }));
const ask: fc.Arbitrary<Ask> = fc.oneof(
  fc.record({ kind: fc.constant('gstate' as const), fill: alpha, stroke: alpha }),
  fc.record({ kind: fc.constantFrom('mask' as const, 'Shading' as const, 'XObject' as const, 'Font' as const, 'Pattern' as const), id: fc.integer({ min: 1, max: 12 }) }),
);

const keyOf = (a: Ask) => (a.kind === 'gstate' ? `gstate ${a.fill} ${a.stroke}` : `${a.kind} ${a.id}`);

function request(r: PageResources, a: Ask): string {
  if (a.kind === 'gstate') return r.extGState(a.fill, a.stroke);
  if (a.kind === 'mask') return r.softMask(new PdfRef(a.id));
  const ref = new PdfRef(a.id);
  return a.kind === 'Shading' ? r.shading(ref) : a.kind === 'XObject' ? r.xobject(ref) : a.kind === 'Font' ? r.font(ref) : r.pattern(ref);
}

/** The `/Resources` category a request's name lands in. */
const category = (a: Ask) => (a.kind === 'gstate' || a.kind === 'mask' ? 'ExtGState' : a.kind);

describe('PageResources', () => {
  it('names each request once and lists exactly what it named', () => {
    const seen = tally();
    fc.assert(
      fc.property(fc.array(ask, { maxLength: 120, size: 'large' }), (asks) => {
        const r = new PageResources();
        const named = new Map<string, { name: string; ask: Ask }>();
        for (const a of asks) {
          const n = request(r, a);
          const before = named.get(keyOf(a));
          if (before) {
            expect(n).toBe(before.name);
            seen.count('repeat');
          } else {
            for (const other of named.values()) if (category(other.ask) === category(a)) expect(n).not.toBe(other.name);
            named.set(keyOf(a), { name: n, ask: a });
          }
          expect(n).toMatch(/^[A-Za-z]+\d+$/);
        }
        const dict = r.dict() as Record<string, Record<string, unknown>>;
        for (const kind of Object.keys(dict)) expect(['ExtGState', 'Shading', 'XObject', 'Font', 'Pattern']).toContain(kind);
        const listed = Object.entries(dict).flatMap(([kind, d]) => Object.keys(d).map((n) => `${kind}/${n}`)).sort();
        expect(listed).toEqual([...named.values()].map(({ name, ask: a }) => `${category(a)}/${name}`).sort());
        for (const { name, ask: a } of named.values()) {
          const entry = dict[category(a)]![name] as Record<string, unknown>;
          if (a.kind === 'gstate') {
            // `===`, since -0 and 0 are one alpha.
            expect(entry.ca === a.fill && entry.CA === a.stroke).toBe(true);
          } else if (a.kind === 'mask') expect(((entry.SMask as Record<string, unknown>).G as PdfRef).id).toBe(a.id);
          else expect((entry as unknown as PdfRef).id).toBe(a.id);
        }
        if (named.size > 20) seen.count('many');
      }),
      runs(RUNS),
    );
    seen.atLeast('repeat', 50);
    seen.atLeast('many', 20);
  }, timeoutFor(RUNS, 5));
});
