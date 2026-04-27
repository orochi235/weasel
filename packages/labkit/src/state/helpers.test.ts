import { describe, expect, it } from 'vitest';
import {
  decodeUrlHash,
  deserializeWorkspaces,
  emptyUndoStack,
  encodeUrlHash,
  labStorageKey,
  serializeWorkspaces,
} from './helpers';
import type { WorkspaceRecord } from './types';

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

describe('serializeWorkspaces / deserializeWorkspaces', () => {
  const ws: WorkspaceRecord = {
    id: 'w1',
    instrumentName: 'Test',
    config: { x: 1 },
    state: { items: [] },
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    undoStack: { past: [1, 2], future: [] },
  };

  it('round-trips workspace records', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result?.id).toBe('w1');
    expect(result?.state).toEqual({ items: [] });
  });

  it('strips undoStack on serialization', () => {
    const serialized = serializeWorkspaces([ws], {});
    const parsed = JSON.parse(serialized) as unknown[];
    expect((parsed[0] as Record<string, unknown>).undoStack).toBeUndefined();
  });

  it('restores emptyUndoStack after deserialization', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result?.undoStack).toEqual({ past: [], future: [] });
  });

  it('uses instrument.serialize / deserialize when provided', () => {
    const serializers = {
      Test: {
        serialize: (s: unknown) => ({ compressed: true, data: s }),
        deserialize: (d: unknown) => (d as { data: unknown }).data,
      },
    };
    const serialized = serializeWorkspaces([ws], serializers);
    const [result] = deserializeWorkspaces(serialized, serializers);
    expect(result?.state).toEqual({ items: [] });
  });

  it('falls back to identity when instrumentName not in registry', () => {
    const serialized = serializeWorkspaces([ws], {});
    const [result] = deserializeWorkspaces(serialized, {});
    expect(result?.state).toEqual({ items: [] });
  });

  it('returns empty array for malformed JSON', () => {
    const result = deserializeWorkspaces('NOT JSON', {});
    expect(result).toEqual([]);
  });
});
