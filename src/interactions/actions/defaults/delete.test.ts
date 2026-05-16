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
});
