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
  it('returns 4 actions: reorder.forward / backward / front / back', () => {
    const acts = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() });
    expect(acts.map(a => a.id).sort()).toEqual(['reorder.back', 'reorder.backward', 'reorder.forward', 'reorder.front']);
  });
  it('forward binding = Mod+]', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.forward')!;
    expect(a.defaultBinding).toEqual({ key: [']', '}'], mod: true });
  });
  it('forward gestureBinding = key(]/}, mod)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.forward')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: [']', '}'], mods: { mod: true } });
  });
  it('backward binding = Mod+[', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.backward')!;
    expect(a.defaultBinding).toEqual({ key: ['[', '{'], mod: true });
  });
  it('backward gestureBinding = key([/{, mod)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.backward')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['[', '{'], mods: { mod: true } });
  });
  it('forward run() emits a reorder op that brings selected ids forward', () => {
    const adapter = makeAdapter();
    const applyOps = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyOps })
      .find(a => a.id === 'reorder.forward')!.run!();
    expect(applyOps).toHaveBeenCalledOnce();
    expect(adapter.children.ROOT).toEqual(['a', 'c', 'b']);
  });
  it('backward run() emits a reorder op that sends selected ids backward', () => {
    const adapter = makeAdapter();
    const applyOps = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyOps })
      .find(a => a.id === 'reorder.backward')!.run!();
    expect(adapter.children.ROOT).toEqual(['b', 'a', 'c']);
  });
  it('run() is a no-op on empty selection', () => {
    const applyOps = vi.fn();
    defaultReorderActions({ getSelection: () => [], applyOps })
      .find(a => a.id === 'reorder.forward')!.run!();
    expect(applyOps).not.toHaveBeenCalled();
  });
  it('front binding = Mod+Shift+]', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.front')!;
    expect(a.defaultBinding).toEqual({ key: [']', '}'], mod: true, shift: true });
  });
  it('front gestureBinding = key(]/}, mod, shift)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.front')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } });
  });
  it('back binding = Mod+Shift+[', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.back')!;
    expect(a.defaultBinding).toEqual({ key: ['[', '{'], mod: true, shift: true });
  });
  it('back gestureBinding = key([/{, mod, shift)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.back')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } });
  });
});
