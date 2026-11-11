/**
 * Property tests of `derive` and `axisDependencies` over whole definitions: derive reports what it cannot use and
 * throws only for a reference cycle or a dangling reference, leaves its input alone, and answers the same twice; and
 * a token's value never changes along an axis its dependencies leave out.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections, type Selection } from '../axes';
import { resolveTokens } from '../dtcg/resolve';
import { outcome, runs, tally, timeoutFor } from '../pbt.fixture';
import { AXES, deepFreeze, definition, DOCUMENTED_THROW } from './definition.fixture';
import { axisDependencies } from './deps';
import { derive } from './derive';

const RUNS = 300;
const SELECTIONS = enumerateSelections(AXES);

describe('derive', () => {
  it('derives any definition or throws for a cycle or a dangling reference, alike every time, writing nothing', () => {
    const t = tally();
    fc.assert(fc.property(definition(), fc.constantFrom(...SELECTIONS), (def, sel) => {
      const frozen = deepFreeze(structuredClone(def));
      const first = outcome(() => derive(frozen, sel));
      expect(outcome(() => derive(frozen, sel))).toEqual(first);
      if (typeof first === 'string') {
        t.count('throws');
        expect(first).toMatch(DOCUMENTED_THROW);
        return;
      }
      t.count('derives');
      expect(Object.keys(first.provenance)).toEqual(Object.keys(first.tokens));
      for (const [n, token] of Object.entries(first.tokens)) {
        const p = first.provenance[n]!;
        if (p.layer === 'ramps' && !p.pinned) expect(token.value).toMatch(/^#[0-9a-f]{6}$/);
        if (p.layer === 'scales' && !p.pinned) expect(token.value).toMatch(/^-?\d+px$/);
      }
      if (first.issues.length > 0) t.count('issues');
    }), runs(RUNS));
    t.atLeast('derives', RUNS / 3);
    t.atLeast('issues', 20);
    t.atLeast('throws', 5);
  }, timeoutFor(RUNS, 20));
});

/** The resolved tokens at `sel`, or null when derive or resolution throws there. */
function resolvedAt(def: Parameters<typeof derive>[0], sel: Selection): Record<string, string> | null {
  try {
    return resolveTokens(derive(def, sel).tokens);
  } catch {
    return null;
  }
}

describe('axisDependencies', () => {
  it('a token is the same at two selections that differ only on an axis it does not depend on', () => {
    const t = tally();
    fc.assert(fc.property(definition(), (def) => {
      const deps = axisDependencies(def);
      const at = new Map(SELECTIONS.map((sel) => [JSON.stringify(sel), resolvedAt(def, sel)]));
      for (const sel of SELECTIONS) {
        const here = at.get(JSON.stringify(sel));
        if (!here) continue;
        for (const axis of Object.keys(AXES)) {
          for (const v of Object.keys(AXES[axis]!.values)) {
            if (v === sel[axis]) continue;
            const there = at.get(JSON.stringify({ ...sel, [axis]: v }));
            if (!there) continue;
            for (const n of new Set([...Object.keys(here), ...Object.keys(there)])) {
              const d = deps[n];
              expect(d, `no dependencies for "${n}"`).toBeDefined();
              if (d!.all.includes(axis)) continue;
              t.count('compared');
              expect({ n, axis, value: there[n] }).toEqual({ n, axis, value: here[n] });
            }
          }
        }
      }
      for (const d of Object.values(deps)) for (const a of d.own) expect(d.all).toContain(a);
    }), runs(RUNS));
    t.atLeast('compared', 500);
  }, timeoutFor(RUNS, 60));
});
