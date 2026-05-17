import { describe, it, expect, vi } from 'vitest';
import { duplicateAction, defaultDuplicateAction } from './duplicate';
import { asNodeId, type NodeId } from 'core/scene/types';

describe('duplicateAction (descriptor)', () => {
  it('id="duplicate", label="Duplicate"', () => {
    expect(duplicateAction.id).toBe('duplicate');
    expect(duplicateAction.label).toBe('Duplicate');
  });

  it('defaultBinding = { key: "d", mod: true }', () => {
    expect(duplicateAction.defaultBinding).toEqual({ key: 'd', mod: true });
  });

  it('gestureBinding = { kind: "key", key: "d", mods: { mod: true } }', () => {
    expect(duplicateAction.gestureBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(duplicateAction.invoker?.timing).toBe('immediate');
  });
});

describe('defaultDuplicateAction (legacy bridge)', () => {
  const cloneNode = vi.fn((id: NodeId) => ({ id: asNodeId(id + "'") }));

  it('id="duplicate", label="Duplicate", binding={key:"d", mod:true}', () => {
    const a = defaultDuplicateAction({ getSelection: () => [asNodeId('a')], cloneNode, applyOps: vi.fn() });
    expect(a.id).toBe('duplicate');
    expect(a.label).toBe('Duplicate');
    expect(a.defaultBinding).toEqual({ key: 'd', mod: true });
  });
  it('run() clones each selected id and dispatches insert+select ops', () => {
    const applyOps = vi.fn();
    const a = defaultDuplicateAction({
      getSelection: () => [asNodeId('a'), asNodeId('b')],
      cloneNode: (id) => ({ id: asNodeId(id + "'") }),
      applyOps,
    });
    a.run!();
    expect(applyOps).toHaveBeenCalledOnce();
    const ops = applyOps.mock.calls[0][0];
    expect(ops).toHaveLength(3); // 2 inserts + 1 setSelection
  });
  it('run() is a no-op on empty selection', () => {
    const applyOps = vi.fn();
    const a = defaultDuplicateAction({ getSelection: () => [], cloneNode, applyOps });
    a.run!();
    expect(applyOps).not.toHaveBeenCalled();
  });
  it('uses default offset {dx:8, dy:8} passed to cloneNode', () => {
    const clone = vi.fn((id: NodeId) => ({ id: asNodeId(id + "'") }));
    const a = defaultDuplicateAction({ getSelection: () => [asNodeId('a')], cloneNode: clone, applyOps: vi.fn() });
    a.run!();
    expect(clone).toHaveBeenCalledWith('a', { dx: 8, dy: 8 });
  });
  it('declares gestureBinding mirroring defaultBinding', () => {
    const a = defaultDuplicateAction({ getSelection: () => [asNodeId('a')], cloneNode, applyOps: vi.fn() });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
  });
  it('bridge does not expose invoker (legacy run path stays active)', () => {
    const a = defaultDuplicateAction({ getSelection: () => [], cloneNode, applyOps: vi.fn() });
    expect(a.invoker).toBeUndefined();
  });
});
