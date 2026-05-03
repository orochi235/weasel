import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroup, useUngroup, type GroupActionAdapter } from './group';
import type { Group } from '../../../groups/types';
import type { Op } from '../../../../core/ops/types';

interface Harness {
  adapter: GroupActionAdapter;
  selection: string[];
  groups: Map<string, Group>;
  batches: { ops: Op[]; label: string }[];
}

function makeHarness(initialSelection: string[] = [], initialGroups: Group[] = []): Harness {
  const groups = new Map<string, Group>();
  for (const g of initialGroups) groups.set(g.id, { id: g.id, members: [...g.members] });
  const h: Harness = {
    selection: [...initialSelection],
    groups,
    batches: [],
    adapter: {} as GroupActionAdapter,
  };
  h.adapter = ({
    getSelection: () => h.selection,
    // SetSelection ops cast adapter to { setSelection } — extend the adapter
    // so the harness round-trips selection through the same op path.
    setSelection: (ids: string[]) => { h.selection = [...ids]; },
    applyBatch: (ops: Op[], label: string) => {
      h.batches.push({ ops, label });
      for (const op of ops) op.apply(h.adapter);
    },
    getGroup: (id: string) => h.groups.get(id),
    getGroupsForMember: (id: string) =>
      [...h.groups.values()].filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g: Group) => { h.groups.set(g.id, { id: g.id, members: [...g.members] }); },
    removeGroup: (id: string) => { h.groups.delete(id); },
    addToGroup: (gid: string, ids: string[]) => {
      const g = h.groups.get(gid);
      if (g) g.members.push(...ids);
    },
    removeFromGroup: (gid: string, ids: string[]) => {
      const g = h.groups.get(gid);
      if (g) g.members = g.members.filter((m) => !ids.includes(m));
    },
  } as unknown) as GroupActionAdapter;
  return h;
}

describe('useGroup', () => {
  it('wraps the current selection in a new virtual group and selects it', () => {
    const h = makeHarness(['a', 'b']);
    const { result } = renderHook(() =>
      useGroup(h.adapter, { newGroupId: () => 'g1' }),
    );
    let id: string | null = null;
    act(() => { id = result.current.group(); });
    expect(id).toBe('g1');
    expect(h.groups.get('g1')?.members).toEqual(['a', 'b']);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].label).toBe('Group');
    expect(h.selection).toEqual(['g1']);
  });

  it('is a no-op when selection is below minMembers (default 2)', () => {
    const h = makeHarness(['a']);
    const { result } = renderHook(() => useGroup(h.adapter));
    let id: string | null = 'sentinel';
    act(() => { id = result.current.group(); });
    expect(id).toBeNull();
    expect(h.groups.size).toBe(0);
    expect(h.batches).toHaveLength(0);
  });

  it('uses a custom label when provided', () => {
    const h = makeHarness(['a', 'b']);
    const { result } = renderHook(() =>
      useGroup(h.adapter, { newGroupId: () => 'g1', label: 'Bundle' }),
    );
    act(() => { result.current.group(); });
    expect(h.batches[0].label).toBe('Bundle');
  });

  it('mints unique ids by default across calls', () => {
    const h = makeHarness(['a', 'b']);
    const { result } = renderHook(() => useGroup(h.adapter));
    let id1: string | null = null;
    let id2: string | null = null;
    act(() => { id1 = result.current.group(); });
    // Reset selection so a second group is meaningful.
    h.selection = ['c', 'd'];
    act(() => { id2 = result.current.group(); });
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});

describe('useUngroup', () => {
  it('dissolves selected groups and replaces selection with their members', () => {
    const h = makeHarness(['g1'], [{ id: 'g1', members: ['a', 'b', 'c'] }]);
    const { result } = renderHook(() => useUngroup(h.adapter));
    let dissolved: string[] = [];
    act(() => { dissolved = result.current.ungroup(); });
    expect(dissolved).toEqual(['g1']);
    expect(h.groups.has('g1')).toBe(false);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].label).toBe('Ungroup');
  });

  it('preserves non-group ids in the selection alongside dissolved members', () => {
    const h = makeHarness(['x', 'g1'], [{ id: 'g1', members: ['a', 'b'] }]);
    const { result } = renderHook(() => useUngroup(h.adapter));
    act(() => { result.current.ungroup(); });
    expect(h.selection).toEqual(['x', 'a', 'b']);
  });

  it('deduplicates members shared across multiple dissolved groups', () => {
    const h = makeHarness(
      ['g1', 'g2'],
      [
        { id: 'g1', members: ['a', 'b'] },
        { id: 'g2', members: ['b', 'c'] },
      ],
    );
    const { result } = renderHook(() => useUngroup(h.adapter));
    act(() => { result.current.ungroup(); });
    expect(h.selection).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when the selection contains no groups', () => {
    const h = makeHarness(['a', 'b']);
    const { result } = renderHook(() => useUngroup(h.adapter));
    let dissolved: string[] = ['sentinel'];
    act(() => { dissolved = result.current.ungroup(); });
    expect(dissolved).toEqual([]);
    expect(h.batches).toHaveLength(0);
  });

  it('is a no-op on empty selection', () => {
    const h = makeHarness([]);
    const { result } = renderHook(() => useUngroup(h.adapter));
    let dissolved: string[] = ['sentinel'];
    act(() => { dissolved = result.current.ungroup(); });
    expect(dissolved).toEqual([]);
    expect(h.batches).toHaveLength(0);
  });
});
