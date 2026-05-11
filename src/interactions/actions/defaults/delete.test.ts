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
      applyBatch: vi.fn(),
    });
    expect(a.id).toBe('delete');
    expect(a.label).toBe('Delete');
    expect(a.defaultBinding).toEqual({ key: ['Delete', 'Backspace'] });
  });

  it('run() emits one DeleteOp per id + SetSelectionOp([])', () => {
    const applyBatch = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId],
      applyBatch,
    });
    a.run();
    expect(applyBatch).toHaveBeenCalledOnce();
    const [ops, label] = applyBatch.mock.calls[0];
    expect(label).toBe('Delete');
    // 2 DeleteOps + 1 SetSelectionOp = 3 ops total.
    expect(ops).toHaveLength(3);
    // Verify the SetSelectionOp clears selection.
    const mockAdapter = { setSelection: vi.fn() };
    ops[2].apply(mockAdapter);
    expect(mockAdapter.setSelection).toHaveBeenCalledWith([]);
  });

  it('uses getNode() for the captured payload, enabling full restore on undo', () => {
    const applyBatch = vi.fn();
    const fatNode = { id: 'a', extra: 'payload' };
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      getNode: () => fatNode,
      applyBatch,
    });
    a.run();
    const [ops] = applyBatch.mock.calls[0];
    // Invert the first DeleteOp; the inverse InsertOp should carry the fat node.
    const inverse = ops[0].invert();
    const insertAdapter = { insertNode: vi.fn() };
    inverse.apply(insertAdapter);
    expect(insertAdapter.insertNode).toHaveBeenCalledWith(fatNode);
  });

  it('falls back to a {id} stub when getNode is omitted', () => {
    const applyBatch = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      applyBatch,
    });
    a.run();
    const [ops] = applyBatch.mock.calls[0];
    const inverse = ops[0].invert();
    const insertAdapter = { insertNode: vi.fn() };
    inverse.apply(insertAdapter);
    expect(insertAdapter.insertNode).toHaveBeenCalledWith({ id: 'a' });
  });

  it('filter narrows the deleted set', () => {
    const applyBatch = vi.fn();
    const a = defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId, 'c' as NodeId],
      filter: (ids) => ids.filter((id) => id !== 'b'),
      applyBatch,
    });
    a.run();
    const [ops] = applyBatch.mock.calls[0];
    // 2 DeleteOps (a, c) + 1 SetSelectionOp.
    expect(ops).toHaveLength(3);
  });

  it('no-op when selection is empty', () => {
    const applyBatch = vi.fn();
    defaultDeleteAction({ getSelection: () => [], applyBatch }).run();
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('no-op when filter reduces selection to []', () => {
    const applyBatch = vi.fn();
    defaultDeleteAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId],
      filter: () => [],
      applyBatch,
    }).run();
    expect(applyBatch).not.toHaveBeenCalled();
  });

  it('enabled reflects post-filter selection emptiness', () => {
    const empty = defaultDeleteAction({
      getSelection: () => [],
      applyBatch: vi.fn(),
    });
    expect(empty.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
    const withSel = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      applyBatch: vi.fn(),
    });
    expect(withSel.enabled?.()).toBe(true);
    const filteredOut = defaultDeleteAction({
      getSelection: () => ['a' as NodeId],
      filter: () => [],
      applyBatch: vi.fn(),
    });
    expect(filteredOut.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
  });
});
