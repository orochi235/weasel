import { describe, expect, it } from 'vitest';
import {
  decodeUrlHash,
  deserializeWorkspaces,
  emptyUndoStack,
  encodeUrlHash,
  labStorageKey,
  serializeWorkspaces,
} from './helpers';

describe('labStorageKey', () => {
  it('produces namespaced keys', () => {
    expect(labStorageKey('my-lab', 'workspaces')).toBe('lk:my-lab:workspaces');
    expect(labStorageKey('my-lab', 'saves')).toBe('lk:my-lab:saves');
    expect(labStorageKey('my-lab', 'theme')).toBe('lk:my-lab:theme');
  });
});

describe('encodeUrlHash / decodeUrlHash', () => {
  it('round-trips a string', () => {
    const original = JSON.stringify({ workspaces: '[]', saves: '[]' });
    expect(decodeUrlHash(encodeUrlHash(original))).toBe(original);
  });

  it('returns null for an empty or invalid hash', () => {
    expect(decodeUrlHash('')).toBeNull();
    expect(decodeUrlHash('not-base64!!!')).toBeNull();
  });
});

describe('emptyUndoStack', () => {
  it('returns an empty stack', () => {
    expect(emptyUndoStack()).toEqual({ past: [], future: [] });
  });
});

describe('serializeWorkspaces', () => {
  it('returns records with the undo stack dropped', () => {
    const records = serializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: { a: 1 },
          state: { b: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          undoStack: { past: [{ b: 1 }], future: [] },
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
    const records = serializeWorkspaces(
      [
        {
          id: 'w1',
          instrumentName: 'Test',
          config: {},
          state: { n: 2 },
          view: { zoom: 1, pan: { x: 0, y: 0 } },
          undoStack: { past: [], future: [] },
        },
      ],
      { Test: { serialize: (s) => ({ doubled: (s as { n: number }).n * 2 }) } },
    );
    expect(records[0].state).toEqual({ doubled: 4 });
  });
});

describe('deserializeWorkspaces', () => {
  it('rebuilds records with an empty undo stack', () => {
    const out = deserializeWorkspaces(
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
    expect(out[0].undoStack).toEqual({ past: [], future: [] });
  });

  it('runs the instrument deserializer over the state', () => {
    const out = deserializeWorkspaces(
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
    expect(deserializeWorkspaces(undefined as never, {})).toEqual([]);
  });
});
