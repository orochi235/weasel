import { describe, it, expect, vi } from 'vitest';
import { defaultReorderActions } from './reorder';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

interface FakeAdapter {
  selection: NodeId[];
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  getSelection(): NodeId[];
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
}

function makeAdapter(): FakeAdapter {
  return {
    selection: [asNodeId('b')],
    parents: { a: null, b: null, c: null },
    children: { ROOT: ['a', 'b', 'c'] },
    getSelection() { return this.selection.slice(); },
    getParent(id: string) { return this.parents[id] ?? null; },
    getChildren(parentId: string | null) { return (this.children[parentId ?? 'ROOT'] ?? []).slice(); },
    setChildOrder(parentId: string | null, ids: string[]) { this.children[parentId ?? 'ROOT'] = ids.slice(); },
  };
}

describe('defaultReorderActions', () => {
  it('returns 2 actions: reorder.forward, reorder.backward', () => {
    const acts = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyBatch: vi.fn() });
    expect(acts.map(a => a.id).sort()).toEqual(['reorder.backward', 'reorder.forward']);
  });
  it('forward binding = Mod+]', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyBatch: vi.fn() }).find(x => x.id === 'reorder.forward')!;
    expect(a.defaultBinding).toEqual({ key: [']', '}'], mod: true });
  });
  it('backward binding = Mod+[', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyBatch: vi.fn() }).find(x => x.id === 'reorder.backward')!;
    expect(a.defaultBinding).toEqual({ key: ['[', '{'], mod: true });
  });
  it('forward run() emits a reorder op that brings selected ids forward', () => {
    const adapter = makeAdapter();
    const applyBatch = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyBatch })
      .find(a => a.id === 'reorder.forward')!.run();
    expect(applyBatch).toHaveBeenCalledOnce();
    expect(adapter.children.ROOT).toEqual(['a', 'c', 'b']);
  });
  it('backward run() emits a reorder op that sends selected ids backward', () => {
    const adapter = makeAdapter();
    const applyBatch = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyBatch })
      .find(a => a.id === 'reorder.backward')!.run();
    expect(adapter.children.ROOT).toEqual(['b', 'a', 'c']);
  });
  it('run() is a no-op on empty selection', () => {
    const applyBatch = vi.fn();
    defaultReorderActions({ getSelection: () => [], applyBatch })
      .find(a => a.id === 'reorder.forward')!.run();
    expect(applyBatch).not.toHaveBeenCalled();
  });
});
