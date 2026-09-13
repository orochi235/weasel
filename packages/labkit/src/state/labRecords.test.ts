import { describe, expect, it } from 'vitest';
import { CURRENT_DOCUMENT_VERSION } from './document';
import {
  documentOfRecords,
  labPrefix,
  parseRecordName,
  recordsOfDocument,
  trialRecord,
  valueRecord,
} from './labRecords';
import type { LabDocument } from './types';

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

describe('record names', () => {
  it('encodes the storage key, so no lab prefix contains another', () => {
    expect(labPrefix('drag-lab')).toBe('lk:drag-lab:');
    expect(labPrefix('a:trial:x')).toBe('lk:a%3Atrial%3Ax:');
    expect(labPrefix('a:trial:x').startsWith(labPrefix('a'))).toBe(false);
  });

  it('round-trips ids holding the separator', () => {
    expect(parseRecordName(trialRecord('odd:id'))).toEqual({ kind: 'trial', id: 'odd:id' });
  });

  it('scopes a value to its trial or to the lab', () => {
    expect(valueRecord('t:1', 'tab')).toBe('value:trial:t%3A1:tab');
    expect(valueRecord(null, 'tab')).toBe('value:lab:tab');
    expect(parseRecordName(valueRecord('t:1', 'a:b'))).toEqual({ kind: 'value' });
  });

  it('answers null for a name no lab writes', () => {
    for (const name of [
      'doc',
      'meta:x',
      'trial:',
      'trial:a:b',
      'value:lab',
      'value:x:y',
      'trial:%E0%A4%A',
    ]) {
      expect(parseRecordName(name)).toBeNull();
    }
  });
});

describe('documents and records', () => {
  const doc: LabDocument = {
    version: CURRENT_DOCUMENT_VERSION,
    trials: [
      { id: 'b', instrumentName: 'T', config: {}, state: { n: 2 }, view: VIEW },
      { id: 'a', instrumentName: 'T', config: {}, state: { n: 1 }, view: VIEW },
    ],
    saves: [
      {
        id: 's2',
        name: 'later',
        trialId: 'a',
        instrumentName: 'T',
        config: {},
        state: {},
        savedAt: 2,
      },
      {
        id: 's1',
        name: 'earlier',
        trialId: 'a',
        instrumentName: 'T',
        config: {},
        state: {},
        savedAt: 1,
      },
    ],
    layout: { a: { h: 1 } },
    undockedPanels: {},
    mode: 'dark',
  };

  it('writes meta last', () => {
    const names = recordsOfDocument(doc).map(([name]) => name);
    expect(names.at(-1)).toBe('meta');
  });

  it('joins back into the document it came from, trials in stored order', () => {
    const joined = documentOfRecords(recordsOfDocument(doc).reverse());
    expect(joined?.doc).toEqual({ ...doc, saves: [doc.saves[1], doc.saves[0]] });
    expect([...(joined?.orders ?? [])]).toEqual([
      ['b', 0],
      ['a', 1],
    ]);
  });

  it('breaks an order tie by id', () => {
    const joined = documentOfRecords([
      ['meta', { version: 4, mode: 'auto' }],
      ['trial:z', { instrumentName: 'T', order: 0 }],
      ['trial:m', { instrumentName: 'T', order: 0 }],
    ]);
    expect((joined?.doc.trials as { id: string }[]).map((t) => t.id)).toEqual(['m', 'z']);
  });

  it('is null without a meta record', () => {
    expect(documentOfRecords([['trial:a', { instrumentName: 'T', order: 0 }]])).toBeNull();
  });
});
