import { describe, it, expect } from 'vitest';
import { findScopedConflicts } from './conflicts';
import type { Tool } from '../../types';

const keyL = (actionId: string) => ({ spec: { kind: 'key', key: 'L' }, actionId });
const keymap = (id: string, bindings: unknown[]) =>
  ({ id, eligibility: { keymap: true }, bindings }) as unknown as Tool;
const ambient = (id: string, bindings: unknown[]) =>
  ({ id, eligibility: { always: true }, bindings }) as unknown as Tool;

describe('findScopedConflicts with keymaps', () => {
  it('does not compare a keymap with the ambient bindings it is never live beside', () => {
    expect(findScopedConflicts({ registry: [], ambient: [keymap('loupe', [keyL('a')]), ambient('canvas', [keyL('b')])] })).toEqual([]);
  });

  it('does not compare two keymaps, which are never live at once', () => {
    expect(findScopedConflicts({ registry: [], ambient: [keymap('a', [keyL('x')]), keymap('b', [keyL('y')])] })).toEqual([]);
  });

  it('still flags a keymap colliding with itself', () => {
    expect(findScopedConflicts({ registry: [], ambient: [keymap('loupe', [keyL('a'), keyL('b')])] })).toHaveLength(1);
  });
});
