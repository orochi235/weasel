import { describe, it, expect, vi } from 'vitest';
import { defaultDuplicateAction } from './duplicate';
import { asNodeId, type NodeId } from '../../../core/scene/types';

describe('defaultDuplicateAction', () => {
  const cloneObject = vi.fn((id: NodeId) => ({ id: asNodeId(id + "'") }));

  it('id="duplicate", label="Duplicate", binding={key:"d", mod:true}', () => {
    const a = defaultDuplicateAction({ getSelection: () => [asNodeId('a')], cloneObject, applyBatch: vi.fn() });
    expect(a.id).toBe('duplicate');
    expect(a.label).toBe('Duplicate');
    expect(a.defaultBinding).toEqual({ key: 'd', mod: true });
  });
  it('run() clones each selected id and dispatches insert+select ops', () => {
    const applyBatch = vi.fn();
    const a = defaultDuplicateAction({
      getSelection: () => [asNodeId('a'), asNodeId('b')],
      cloneObject: (id) => ({ id: asNodeId(id + "'") }),
      applyBatch,
    });
    a.run();
    expect(applyBatch).toHaveBeenCalledOnce();
    const ops = applyBatch.mock.calls[0][0];
    expect(ops).toHaveLength(3); // 2 inserts + 1 setSelection
  });
  it('run() is a no-op on empty selection', () => {
    const applyBatch = vi.fn();
    const a = defaultDuplicateAction({ getSelection: () => [], cloneObject, applyBatch });
    a.run();
    expect(applyBatch).not.toHaveBeenCalled();
  });
  it('uses default offset {dx:8, dy:8} passed to cloneObject', () => {
    const clone = vi.fn((id: NodeId) => ({ id: asNodeId(id + "'") }));
    const a = defaultDuplicateAction({ getSelection: () => [asNodeId('a')], cloneObject: clone, applyBatch: vi.fn() });
    a.run();
    expect(clone).toHaveBeenCalledWith('a', { dx: 8, dy: 8 });
  });
});
