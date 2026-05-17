/**
 * Tests for groupAction/ungroupAction descriptors and their legacy bridge
 * factories defaultGroupAction/defaultUngroupAction.
 */
import { describe, it, expect, vi } from 'vitest';
import { groupAction, ungroupAction, defaultGroupAction, defaultUngroupAction } from './group';
import type { NodeId } from 'core/scene/types';
import type { Group } from 'features/groups/types';
import { ActionDisabledReason } from '../registry';

describe('groupAction (descriptor)', () => {
  it('id="group", label="Group"', () => {
    expect(groupAction.id).toBe('group');
    expect(groupAction.label).toBe('Group');
  });

  it('gestureBinding = { kind: "key", key: "g", mods: { mod: true } }', () => {
    expect(groupAction.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(groupAction.invoker?.timing).toBe('immediate');
  });
});

describe('ungroupAction (descriptor)', () => {
  it('id="ungroup", label="Ungroup"', () => {
    expect(ungroupAction.id).toBe('ungroup');
    expect(ungroupAction.label).toBe('Ungroup');
  });

  it('gestureBinding = { kind: "key", key: "g", mods: { mod: true, shift: true } }', () => {
    expect(ungroupAction.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true, shift: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(ungroupAction.invoker?.timing).toBe('immediate');
  });
});

describe('defaultGroupAction (legacy bridge)', () => {
  const baseDeps = () => ({
    getSelection: () => ['a' as NodeId, 'b' as NodeId],
    applyOps: vi.fn(),
  });

  it('emits id=group with Mod+G default binding', () => {
    const action = defaultGroupAction(baseDeps());
    expect(action.id).toBe('group');
    expect(action.label).toBe('Group');
    expect(action.defaultBinding).toEqual({ key: 'g', mod: true });
  });

  it('emits gestureBinding = key(g, mod)', () => {
    const action = defaultGroupAction(baseDeps());
    expect(action.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true } });
  });

  it('run() dispatches a CreateGroupOp + SetSelectionOp on a ≥2 selection', () => {
    const deps = baseDeps();
    const action = defaultGroupAction({ ...deps, newGroupId: () => 'g1' });
    action.run!();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Group');
    expect(ops).toHaveLength(2);
  });

  it('uses provided newGroupId to mint the id', () => {
    const deps = baseDeps();
    const action = defaultGroupAction({ ...deps, newGroupId: () => 'custom-id' });
    action.run!();
    const [ops] = deps.applyOps.mock.calls[0];
    const mockAdapter = { setSelection: vi.fn() };
    ops[1].apply(mockAdapter);
    expect(mockAdapter.setSelection).toHaveBeenCalledWith(['custom-id']);
  });

  it('no-op below minMembers (default 2)', () => {
    const deps = { getSelection: () => ['only' as NodeId], applyOps: vi.fn() };
    defaultGroupAction(deps).run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('respects custom minMembers', () => {
    const deps = {
      getSelection: () => ['a' as NodeId, 'b' as NodeId, 'c' as NodeId],
      applyOps: vi.fn(),
    };
    // minMembers=4 → 3 selected → no-op.
    defaultGroupAction({ ...deps, minMembers: 4, newGroupId: () => 'g1' }).run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled returns true ≥ minMembers, SelectionRequired below', () => {
    const a = defaultGroupAction({ getSelection: () => ['only' as NodeId], applyOps: vi.fn() });
    expect(a.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
    const b = defaultGroupAction(baseDeps());
    expect(b.enabled?.()).toBe(true);
  });

  it('default newGroupId mints a string with the g_ prefix', () => {
    const deps = baseDeps();
    const action = defaultGroupAction(deps);
    action.run!();
    const [ops] = deps.applyOps.mock.calls[0];
    const mockAdapter = { setSelection: vi.fn() };
    ops[1].apply(mockAdapter);
    const [[id]] = mockAdapter.setSelection.mock.calls[0];
    expect(id).toMatch(/^g_/);
  });

  it('bridge does not expose invoker (legacy run path stays active)', () => {
    const a = defaultGroupAction(baseDeps());
    expect(a.invoker).toBeUndefined();
  });
});

describe('defaultUngroupAction (legacy bridge)', () => {
  const g1: Group = { id: 'g1', members: ['a', 'b', 'c'] };

  it('emits id=ungroup with Mod+Shift+G binding', () => {
    const a = defaultUngroupAction({
      getSelection: () => [],
      getGroup: () => undefined,
      applyOps: vi.fn(),
    });
    expect(a.id).toBe('ungroup');
    expect(a.defaultBinding).toEqual({ key: 'g', mod: true, shift: true });
  });

  it('emits gestureBinding = key(g, mod, shift)', () => {
    const a = defaultUngroupAction({
      getSelection: () => [],
      getGroup: () => undefined,
      applyOps: vi.fn(),
    });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true, shift: true } });
  });

  it('dissolves selected groups; selection becomes members + non-group ids', () => {
    const applyOps = vi.fn();
    const a = defaultUngroupAction({
      getSelection: () => ['x' as NodeId, 'g1' as NodeId],
      getGroup: (id) => (id === 'g1' ? g1 : undefined),
      applyOps,
    });
    a.run!();
    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Ungroup');
    // One DissolveGroupOp + one SetSelectionOp.
    expect(ops).toHaveLength(2);
    const mockAdapter = { setSelection: vi.fn() };
    ops[1].apply(mockAdapter);
    expect(mockAdapter.setSelection).toHaveBeenCalledWith(['x', 'a', 'b', 'c']);
  });

  it('dedupes members shared across multiple dissolved groups', () => {
    const g2: Group = { id: 'g2', members: ['b', 'c', 'd'] };
    const applyOps = vi.fn();
    const a = defaultUngroupAction({
      getSelection: () => ['g1' as NodeId, 'g2' as NodeId],
      getGroup: (id) => (id === 'g1' ? g1 : id === 'g2' ? g2 : undefined),
      applyOps,
    });
    a.run!();
    const [ops] = applyOps.mock.calls[0];
    const mockAdapter = { setSelection: vi.fn() };
    ops[2].apply(mockAdapter);
    expect(mockAdapter.setSelection).toHaveBeenCalledWith(['a', 'b', 'c', 'd']);
  });

  it('no-op when nothing in selection is a group', () => {
    const applyOps = vi.fn();
    defaultUngroupAction({
      getSelection: () => ['a' as NodeId, 'b' as NodeId],
      getGroup: () => undefined,
      applyOps,
    }).run!();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('no-op on empty selection', () => {
    const applyOps = vi.fn();
    defaultUngroupAction({
      getSelection: () => [],
      getGroup: () => undefined,
      applyOps,
    }).run!();
    expect(applyOps).not.toHaveBeenCalled();
  });

  it('enabled returns true iff any selected id is a group', () => {
    const groupInSel = defaultUngroupAction({
      getSelection: () => ['g1' as NodeId],
      getGroup: (id) => (id === 'g1' ? g1 : undefined),
      applyOps: vi.fn(),
    });
    expect(groupInSel.enabled?.()).toBe(true);
    const noGroup = defaultUngroupAction({
      getSelection: () => ['a' as NodeId],
      getGroup: () => undefined,
      applyOps: vi.fn(),
    });
    expect(noGroup.enabled?.()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('bridge does not expose invoker (legacy run path stays active)', () => {
    const a = defaultUngroupAction({
      getSelection: () => [],
      getGroup: () => undefined,
      applyOps: vi.fn(),
    });
    expect(a.invoker).toBeUndefined();
  });
});
