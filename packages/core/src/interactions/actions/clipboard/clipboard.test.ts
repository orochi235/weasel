/**
 * Tests for the `clipboard.copy` / `clipboard.cut` descriptors.
 */
import { describe, it, expect, vi } from 'vitest';
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from './action';
import type { ClipboardDep } from '../depSchema';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

function makeStubScene(ids: string[]) {
  const nodes = new Map<string, { id: NodeId; kind: 'mark'; layer: string; pose: unknown; data: unknown; parent: null }>();
  for (const id of ids) {
    nodes.set(id, { id: asNodeId(id), kind: 'mark', layer: 'main', pose: {}, data: {}, parent: null });
  }
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];
  return {
    scene: {
      get: (id: NodeId) => nodes.get(id),
      childrenOf: () => [],
      get roots() { return [...nodes.keys()].map(asNodeId); },
      removalClosure: (want: readonly NodeId[]) => [...want],
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
    expect(clipboardCopyAction.defaultBinding).toEqual([{ spec: { kind: 'key', key: 'c', mods: { mod: true } }, opts: { id: 'clipboard.copy.key' } }]);
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
    expect(clipboardCutAction.defaultBinding).toEqual([{ spec: { kind: 'key', key: 'x', mods: { mod: true } }, opts: { id: 'clipboard.cut.key' } }]);
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

describe('clipboardPasteAction', () => {
  const clipboard = (empty: boolean): ClipboardDep => ({ copy: vi.fn(), paste: vi.fn(), isEmpty: () => empty });

  it('has no key binding — Cmd+V arrives as a paste event', () => {
    expect(clipboardPasteAction.defaultBinding).toBeUndefined();
  });

  it('is enabled only while the clipboard holds something', () => {
    expect(clipboardPasteAction.enabled?.({ clipboard: clipboard(false) })).toBe(true);
    expect(clipboardPasteAction.enabled?.({ clipboard: clipboard(true) })).toBe('not-applicable');
  });

  it('runs the clipboard dep\'s paste', () => {
    const dep = clipboard(false);
    (clipboardPasteAction.invoker as ImmediateInvoker).run({ clipboard: dep });
    expect(dep.paste).toHaveBeenCalledTimes(1);
  });
});
