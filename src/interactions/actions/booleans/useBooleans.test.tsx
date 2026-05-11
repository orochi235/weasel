import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBooleans } from './useBooleans';
import type { BooleansAdapter } from './booleans';
import type { Path } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

function makeAdapter() {
  const nodes: { id: NodeId; path: Path }[] = [
    { id: 'a' as NodeId, path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b' as NodeId, path: { kind: 'rect', x: 5, y: 5, width: 10, height: 10 } },
  ];
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const paths = new Map(nodes.map((n) => [n.id, n.path]));
  const state = {
    batches: [] as { ops: Op[]; label: string }[],
    inserted: [] as { id: string }[],
    removed: [] as string[],
  };
  let nextId = 1;
  const adapter: BooleansAdapter = {
    getSelection: () => nodes.map((n) => n.id),
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0),
    createPathNode: () => ({ id: `r${nextId++}` }),
    insertNode: (n) => state.inserted.push(n),
    removeNode: (id) => state.removed.push(id),
    setSelection: () => {},
    applyBatch: (ops, label) => {
      state.batches.push({ ops, label: label ?? '' });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, state };
}

describe('useBooleans', () => {
  it('returns five callables — one per op', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useBooleans(adapter));
    expect(typeof result.current.union).toBe('function');
    expect(typeof result.current.intersect).toBe('function');
    expect(typeof result.current.subtract).toBe('function');
    expect(typeof result.current.exclude).toBe('function');
    expect(typeof result.current.divide).toBe('function');
  });

  it('union dispatches one batch and inserts one node', () => {
    const h = makeAdapter();
    const { result } = renderHook(() => useBooleans(h.adapter));
    act(() => { result.current.union(); });
    expect(h.state.batches).toHaveLength(1);
    expect(h.state.inserted).toHaveLength(1);
    expect(h.state.removed.sort()).toEqual(['a', 'b']);
  });
});
