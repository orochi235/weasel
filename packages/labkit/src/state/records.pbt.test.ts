/**
 * Property tests of how a lab is stored: a document split into records and joined back is the document, whatever
 * order storage hands the records back in; a record's name reads back as what it names; trials serialized and read
 * back are the trials; and edit stamps only rise.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { editStamp, lastEditStamp, seedEditStamp } from '../undo/editStamp';
import { CURRENT_DOCUMENT_VERSION } from './document';
import { deserializeTrials, serializeTrials } from './helpers';
import {
  documentOfRecords,
  parseRecordName,
  recordsOfDocument,
  saveRecord,
  trialRecord,
} from './labRecords';
import type { LabDocument, SavedSnapshot, SerializedTrial, TrialRecord } from './types';

const RUNS = 300;

/** Ids as a record name must carry them: any text, the characters a name divides on among it. */
const id = fc.oneof(
  fc.constantFrom('a', 'a:b', '%3A', 'trial:x', '__proto__', ' '),
  fc.string({ unit: 'grapheme', minLength: 1, maxLength: 6 }),
);

const value = fc.jsonValue({ maxDepth: 2 });

const trial = (tid: string) =>
  fc.record({
    id: fc.constant(tid),
    instrumentName: fc.constantFrom('A', 'B'),
    config: value,
    state: value,
    view: value,
  }) as fc.Arbitrary<SerializedTrial>;

const save = (sid: string, savedAt: number) =>
  fc.record({
    id: fc.constant(sid),
    name: fc.string({ maxLength: 4 }),
    trialId: fc.constant('t'),
    instrumentName: fc.constant('A'),
    config: value,
    state: value,
    savedAt: fc.constant(savedAt),
  }) as fc.Arbitrary<SavedSnapshot>;

const doc: fc.Arbitrary<LabDocument> = fc
  .tuple(
    fc.uniqueArray(id, { maxLength: 4 }),
    fc.uniqueArray(id, { maxLength: 4 }),
    fc.uniqueArray(fc.integer({ min: 0, max: 1e6 }), { minLength: 4, maxLength: 4 }),
  )
  .chain(([tids, sids, stamps]) =>
    fc.record({
      version: fc.constant(CURRENT_DOCUMENT_VERSION),
      trials: fc.tuple(...tids.map(trial)),
      saves: fc.tuple(...sids.map((s, i) => save(s, stamps[i] ?? i))),
      layout: fc.dictionary(fc.string({ maxLength: 3 }), value, { maxKeys: 2 }),
      undockedPanels: fc.constant({}),
      mode: fc.constantFrom('light' as const, 'dark' as const, 'auto' as const),
    }),
  );

describe('a lab stored as records', () => {
  it(
    'joins back to the document it was split from, in any order storage returns the records',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          doc,
          fc.infiniteStream(fc.nat()).map((s) => s),
          (d, noise) => {
            const records = recordsOfDocument(d);
            const shuffled = [...records]
              .map((r) => [noise.next().value as number, r] as const)
              .sort(([a], [b]) => a - b)
              .map(([, r]) => r);
            const joined = documentOfRecords(shuffled);
            expect(joined).not.toBeNull();
            expect(joined?.doc).toEqual({
              ...d,
              saves: [...d.saves].sort((a, b) => a.savedAt - b.savedAt),
            });
            d.trials.forEach((tr, i) => {
              expect(joined?.orders.get(tr.id)).toBe(i);
            });
            if (d.trials.length > 1) t.count('several trials');
            if (d.trials.some((tr) => tr.id.includes(':'))) t.count('an id holding a colon');
          },
        ),
        runs(RUNS),
      );
      t.atLeast('several trials', 50);
      t.atLeast('an id holding a colon', 20);
    },
    timeoutFor(RUNS, 3),
  );

  it(
    'names each record so it reads back as what it names',
    () => {
      fc.assert(
        fc.property(id, (i) => {
          expect(parseRecordName(trialRecord(i))).toEqual({ kind: 'trial', id: i });
          expect(parseRecordName(saveRecord(i))).toEqual({ kind: 'save', id: i });
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe('serializeTrials and deserializeTrials', () => {
  it(
    'read back the trials they wrote, through each instrument’s own serializer',
    () => {
      const serializers = {
        A: {
          serialize: (s: unknown) => JSON.stringify(s),
          deserialize: (raw: unknown) => JSON.parse(raw as string),
        },
      };
      fc.assert(
        fc.property(
          fc.uniqueArray(id, { maxLength: 4 }).chain((ids) => fc.tuple(...ids.map(trial))),
          (trials) => {
            const live = trials as unknown as TrialRecord[];
            const stored = serializeTrials(live, serializers);
            for (const [i, s] of stored.entries())
              if (s.instrumentName === 'A') expect(typeof s.state).toBe('string');
              else expect(s.state).toEqual(live[i]?.state);
            expect(deserializeTrials(structuredClone(stored), serializers)).toEqual(live);
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});

describe('editStamp', () => {
  it(
    'hands out stamps that only rise, past any it was seeded with',
    () => {
      const step = fc.oneof(
        fc.constant({ seed: undefined }),
        fc.record({
          seed: fc.oneof(fc.double({ max: 1e300 }), fc.integer({ min: 0, max: 4e12 })),
        }),
      );
      fc.assert(
        fc.property(fc.array(step, { maxLength: 20 }), (steps) => {
          let last = lastEditStamp();
          for (const { seed } of steps) {
            if (seed !== undefined) {
              seedEditStamp(seed);
              if (Number.isFinite(seed)) last = Math.max(last, seed);
              expect(lastEditStamp()).toBe(last);
              continue;
            }
            const stamp = editStamp();
            expect(stamp).toBeGreaterThan(last);
            expect(Number.isFinite(stamp)).toBe(true);
            last = stamp;
          }
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});
