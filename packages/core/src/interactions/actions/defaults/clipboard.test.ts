/**
 * Tests for the `clipboard.copy` / `clipboard.cut` descriptors.
 */
import { describe, it, expect, vi } from 'vitest';
import { clipboardCopyAction, clipboardCutAction, type ClipboardDep } from './clipboard';
import type { ImmediateInvoker } from '../invoker';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { buildDeleteOps } from './delete';

function makeStubScene(ids: string[]) {
  const nodes = new Map<string, { id: NodeId; kind: 'leaf'; layer: string; pose: unknown; data: unknown; parent: null }>();
  for (const id of ids) {
    nodes.set(id, { id: asNodeId(id), kind: 'leaf', layer: 'main', pose: {}, data: {}, parent: null });
  }
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];
  return {
    scene: {
      get: (id: NodeId) => nodes.get(id),
      childrenOf: () => [],
      get roots() { return [...nodes.keys()].map(asNodeId); },
      remove: vi.fn(),
      applyBatch: vi.fn((ops: Op[], label: string) => { applyBatchLog.push({ ops, label }); }),
    },
    applyBatchLog,
  };
}

function makeClipboard() {
  const copy = vi.fn<() => void>();
  const clipboard: ClipboardDep = { copy, paste: vi.fn(), isEmpty: () => false };
  return Object.assign(clipboard, { copy });
}

function makeSelection(ids: string[]) {
  let current = ids;
  return { get: () => current, set: vi.fn((next: string[]) => { current = next; }) };
}

describe('clipboardCopyAction (descriptor)', () => {
  it('is Cmd/Ctrl+C', () => {
    expect(clipboardCopyAction.id).toBe('clipboard.copy');
    expect(clipboardCopyAction.defaultBinding).toEqual({ kind: 'key', key: 'c', mods: { mod: true } });
  });

  it('delegates to the clipboard dep', () => {
    const clipboard = makeClipboard();
    (clipboardCopyAction.invoker as ImmediateInvoker).run({ clipboard } as never);
    expect(clipboard.copy).toHaveBeenCalledTimes(1);
  });

  it('no-ops without the dep', () => {
    expect(() => (clipboardCopyAction.invoker as ImmediateInvoker).run({} as never)).not.toThrow();
  });
});

describe('clipboardCutAction (descriptor)', () => {
  it('is Cmd/Ctrl+X — distinct from the bare `x` a consumer may bind', () => {
    expect(clipboardCutAction.id).toBe('clipboard.cut');
    expect(clipboardCutAction.defaultBinding).toEqual({ kind: 'key', key: 'x', mods: { mod: true } });
  });

  it('copies BEFORE deleting, commits one batch, and clears the selection', () => {
    const { scene, applyBatchLog } = makeStubScene(['a', 'b']);
    const clipboard = makeClipboard();
    const selection = makeSelection(['a', 'b']);
    const order: string[] = [];
    clipboard.copy.mockImplementation(() => { order.push('copy'); });
    const applyOps = vi.fn((ops: Op[], label: string) => { order.push(`apply:${label}:${ops.length}`); });

    (clipboardCutAction.invoker as ImmediateInvoker).run({ clipboard, scene, selection, applyOps } as never);

    expect(order).toEqual(['copy', 'apply:Cut:2']);
    expect(applyBatchLog).toHaveLength(0);
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('falls back to scene.applyBatch without an applyOps hook', () => {
    const { scene, applyBatchLog } = makeStubScene(['a']);
    (clipboardCutAction.invoker as ImmediateInvoker).run({
      clipboard: makeClipboard(), scene, selection: makeSelection(['a']),
    } as never);
    expect(applyBatchLog.map((e) => e.label)).toEqual(['Cut']);
  });

  it('does not copy an empty selection', () => {
    const { scene } = makeStubScene([]);
    const clipboard = makeClipboard();
    (clipboardCutAction.invoker as ImmediateInvoker).run({
      clipboard, scene, selection: makeSelection([]),
    } as never);
    expect(clipboard.copy).not.toHaveBeenCalled();
  });
});

describe('buildDeleteOps subtree collapsing (shared by delete + cut)', () => {
  it('emits one op for a container selected alongside its children', () => {
    // `removeNode` cascades; a second op for the child would throw mid-batch.
    const nodes = new Map<string, { id: NodeId; kind: string; parent: NodeId | null }>([
      ['g', { id: asNodeId('g'), kind: 'container', parent: null }],
      ['a', { id: asNodeId('a'), kind: 'leaf', parent: asNodeId('g') }],
      ['b', { id: asNodeId('b'), kind: 'leaf', parent: asNodeId('g') }],
      ['loose', { id: asNodeId('loose'), kind: 'leaf', parent: null }],
    ]);
    const scene = {
      get: (id: NodeId) => nodes.get(id),
      childrenOf: (id: NodeId) => [...nodes.values()].filter((n) => n.parent === id).map((n) => n.id),
      get roots() { return [...nodes.values()].filter((n) => n.parent == null).map((n) => n.id); },
    };
    const ops = buildDeleteOps(scene as never, ['g', 'a', 'b', 'loose'], 'Cut');
    expect(ops).toHaveLength(2);
  });
});
