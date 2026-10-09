import { createHistory } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import {
  deserializeTrials,
  labStorageKey,
  newId,
  serializeTrials,
} from './helpers';

describe('labStorageKey', () => {
  it('produces namespaced keys', () => {
    expect(labStorageKey('my-lab', 'workspaces')).toBe('lk:my-lab:workspaces');
    expect(labStorageKey('my-lab', 'saves')).toBe('lk:my-lab:saves');
    expect(labStorageKey('my-lab', 'theme')).toBe('lk:my-lab:theme');
  });
});

describe('serializeTrials', () => {
  it('returns records with the undo stack dropped', () => {
    const records = serializeTrials(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: { a: 1 },
          state: { b: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          history: createHistory(null),
        },
      ],
      {},
    );
    expect(records).toEqual([
      {
        id: 'w1',
        instrumentName: 'Test',
        config: { a: 1 },
        state: { b: 2 },
        view: { zoom: 1, pan: { x: 0, y: 0 } },
      },
    ]);
  });

  it('runs the instrument serializer over the state', () => {
    const records = serializeTrials(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { n: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ],
      { Test: { serialize: (s) => ({ doubled: (s as { n: number }).n * 2 }) } },
    );
    expect(records[0].state).toEqual({ doubled: 4 });
  });
});

describe('deserializeTrials', () => {
  it('rebuilds records with no undo history', () => {
    const out = deserializeTrials(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { n: 1 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ],
      {},
    );
    expect(out[0].history).toBeUndefined();
  });

  it('runs the instrument deserializer over the state', () => {
    const out = deserializeTrials(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { doubled: 4 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      ],
      { Test: { deserialize: (d) => ({ n: (d as { doubled: number }).doubled / 2 }) } },
    );
    expect(out[0].state).toEqual({ n: 2 });
  });

  it('returns an empty list when given something that is not an array', () => {
    expect(deserializeTrials(undefined as never, {})).toEqual([]);
  });

  describe('newId', () => {
    it('mints distinct ids', () => {
      expect(newId()).not.toBe(newId());
    });

    it('falls back where crypto.randomUUID is absent', () => {
      // What a lab reached by LAN IP gets: not a secure context, so the
      // function is not there. It used to throw on the first render and show a
      // blank page.
      const real = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
      try {
        expect(newId()).not.toBe(newId());
      } finally {
        Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
      }
    });
  });
});
