/**
 * Tests for `defaultDeleteAction`. Factory packages the deletion path as
 * an `Action` descriptor: `Delete`/`Backspace` bindings, `run` dispatches
 * one DeleteOp per id + a SetSelectionOp([]), `enabled` reflects whether
 * the filtered selection is non-empty.
 */
import { describe, it, expect, vi } from 'vitest';
import { defaultDeleteAction } from './delete';
import type { NodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';

describe('defaultDeleteAction', () => {
  it('emits id=delete with Delete and Backspace bindings', () => {
    const a = defaultDeleteAction({
      getSelection: () => [],
      applyOps: vi.fn(),
      getNodeIndex: () => 0,
    });
    expect(a.id).toBe('delete');
    expect(a.label).toBe('Delete');
    expect(a.defaultBinding).toEqual({ key: ['Delete', 'Backspace'] });
  });

  it('run() emits one DeleteOp per id + SetSelectionOp([])', () => {
    const applyOps = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId],
      applyOps,
      getNodeIndex: () => 0,
    });
    a.run();
    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Delete');
    // 2 DeleteOps + 1 SetSelectionOp = 3 ops total.
    expect(ops).toHaveLength(3);
    // Verify the SetSelectionOp clears selection.
    const mockAdapter = { setSelection: vi.fn() };
    ops[2].apply(mockAdapter);
    expect(mockAdapter.setSelection).toHaveBeenCalledWith([]);
  });

  it('uses getNode() for the captured payload, enabling full restore on undo', () => {
    const applyOps = vi.fn();
    const fatNode = { id: 'a', extra: 'payload' };
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      getNode: () => fatNode,
      applyOps,
      getNodeIndex: () => 0,
    });
    a.run();
    const [ops] = applyOps.mock.calls[0];
    // Invert the first DeleteOp; the inverse InsertOp should carry the fat node.
    const inverse = ops[0].invert();
    const insertAdapter = { insertNode: vi.fn() };
    inverse.apply(insertAdapter);
    expect(insertAdapter.insertNode).toHaveBeenCalledWith(fatNode, 0);
  });

  it('falls back to a {id} stub when getNode is omitted', () => {
    const applyOps = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      applyOps,
      getNodeIndex: () => 0,
    });
    a.run();
    const [ops] = applyOps.mock.calls[0];
    const inverse = ops[0].invert();
    const insertAdapter = { insertNode: vi.fn() };
    inverse.apply(insertAdapter);
    expect(insertAdapter.insertNode).toHaveBeenCalledWith({ id: 'a' }, 0);
  });

  it('filter narrows the deleted set', () => {
    const applyOps = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId, 'c' as NodeId],
      filter: (ids) => ids.filter((id) => id !== 'b'),
      applyOps,
      getNodeIndex: () => 0,
    });
    a.run();
    const [ops] = applyOps.mock.calls[0];
    // 2 DeleteOps (a, c) + 1 SetSelectionOp.
    expect(ops).toHaveLength(3);
  });

  it('no-op when selection is empty', () => {
    const applyOps = vi.fn();
    defaultDeleteAction({ getSelection: () => [], applyOps, getNodeIndex: () => 0 }).run();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('no-op when filter reduces selection to []', () => {
    const applyOps = vi.fn();
    defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId],
      filter: () => [],
      applyOps,
      getNodeIndex: () => 0,
    }).run();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('multi-delete + undo restores original z-order', () => {
    // Mirror real adapter semantics: insertNode splices at index, removeNode
    // splices by id. The forward delete clears the array; the reverse-and-
    // invert (what history.invertEntry produces on undo) re-inserts. Without
    // ordering at capture, descending-index splices clamp against a growing
    // empty array and high-index nodes land at the front.
    const initial = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    let arr = initial.map((n) => ({ ...n }));
    const adapter = {
      insertNode: (n: { id: string }, idx?: number) => {
        arr.splice(idx ?? arr.length, 0, n);
      },
      removeNode: (id: string) => {
        const i = arr.findIndex((n) => n.id === id);
        if (i >= 0) arr.splice(i, 1);
      },
      setSelection: (_: string[]) => {},
    };
    const action = defaultDeleteAction({
      getSelection: () => initial.map((n) => n.id as NodeId),
      getNode: (id) => initial.find((n) => n.id === id) ?? null,
      getNodeIndex: (id) => initial.findIndex((n) => n.id === id),
      applyOps: (ops) => {
        for (const op of ops) op.apply(adapter);
        // Replay history.invertEntry: reverse + invert, then apply.
        const inverses = [...ops].reverse().map((op) => op.invert());
        for (const op of inverses) op.apply(adapter);
      },
    });
    action.run();
    expect(arr.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('enabled reflects post-filter selection emptiness', () => {
    const empty = defaultDeleteAction({
      getSelection: () => [],
      applyOps: vi.fn(),
      getNodeIndex: () => 0,
    });
    expect(empty.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
    const withSel = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      applyOps: vi.fn(),
      getNodeIndex: () => 0,
    });
    expect(withSel.enabled?.()).toBe(true);
    const filteredOut = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      filter: () => [],
      applyOps: vi.fn(),
      getNodeIndex: () => 0,
    });
    expect(filteredOut.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
  });
  it('declares gestureBinding mirroring defaultBinding', () => {
    const a = defaultDeleteAction({
      getSelection: () => [],
      applyOps: vi.fn(),
      getNodeIndex: () => 0,
    });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['Delete', 'Backspace'] });
  });
});
