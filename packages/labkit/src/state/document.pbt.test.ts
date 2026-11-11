/**
 * Property tests of a lab document's way in from storage: a document of any version and any contents migrates to
 * the current one or is refused, never half-migrated; what `normalizeDocument` makes always has the current shape
 * and is a fixed point; and a legacy document's records arrive as the trials of the current one.
 */
import { isPlainObject } from '@weasel-js/registry';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { CURRENT_DOCUMENT_VERSION, MIGRATIONS, normalizeDocument, runMigrations } from './document';

const RUNS = 300;

const anyValue = fc.oneof(
  fc.jsonValue({ maxDepth: 2 }),
  fc.constantFrom(undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 2.5),
);
const mode = fc.constantFrom('light', 'dark', 'auto', 'interstellar', 'neon', undefined);
const version = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 0, max: CURRENT_DOCUMENT_VERSION }) },
  { weight: 1, arbitrary: fc.integer({ min: CURRENT_DOCUMENT_VERSION + 1, max: 99 }) },
  { weight: 1, arbitrary: anyValue },
);

const doc = fc.record(
  {
    version,
    workspaces: anyValue,
    trials: anyValue,
    saves: anyValue,
    layout: anyValue,
    undockedPanels: anyValue,
    mode,
    extra: anyValue,
  },
  { requiredKeys: [] },
);

/** Whether `d` has the current document's shape. */
function current(d: Record<string, unknown>): void {
  expect(d.version).toBe(CURRENT_DOCUMENT_VERSION);
  expect(Array.isArray(d.trials)).toBe(true);
  expect(Array.isArray(d.saves)).toBe(true);
  expect(isPlainObject(d.layout)).toBe(true);
  expect(isPlainObject(d.undockedPanels)).toBe(true);
  expect(['light', 'dark', 'auto']).toContain(d.mode);
}

describe('a stored document', () => {
  it(
    'migrates from any version to the current shape, or is refused, and normalizes to a fixed point',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          doc,
          fc.constantFrom('light', 'dark', 'auto') as fc.Arbitrary<'light'>,
          (raw, fallback) => {
            const before = structuredClone(raw);
            const out = runMigrations(raw, MIGRATIONS, CURRENT_DOCUMENT_VERSION);
            expect(raw).toEqual(before);
            const v = raw.version;
            const stated = typeof v === 'number';
            if (stated && v > CURRENT_DOCUMENT_VERSION) {
              t.count('future');
              expect(out).toEqual({ ok: false, reason: 'future' });
              return;
            }
            if (stated && !(Number.isInteger(v) && v >= 0)) {
              t.count('unreadable version');
              expect(out.ok).toBe(false);
              return;
            }
            expect(out.ok).toBe(true);
            if (!out.ok) return;
            t.count(out.migrated ? 'migrated' : 'current');
            expect(out.migrated).toBe((stated ? v : 0) < CURRENT_DOCUMENT_VERSION);
            const doc = normalizeDocument(out.doc, fallback);
            current(doc as unknown as Record<string, unknown>);
            expect(normalizeDocument(doc as unknown as Record<string, unknown>, fallback)).toEqual(
              doc,
            );
            const from = stated ? v : 0;
            const records = from < 2 ? raw.workspaces : raw.trials;
            if (Array.isArray(records)) {
              t.count('records kept');
              expect(doc.trials).toEqual(records);
            }
            if (Array.isArray(raw.saves)) expect(doc.saves).toEqual(raw.saves);
          },
        ),
        runs(RUNS),
      );
      for (const what of ['future', 'unreadable version', 'migrated', 'current', 'records kept'])
        t.atLeast(what, 10);
    },
    timeoutFor(RUNS, 2),
  );
});
