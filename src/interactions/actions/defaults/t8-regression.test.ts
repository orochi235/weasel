/**
 * Phase 4 T8 regression — legacy bridge run bodies for delete / duplicate /
 * group / ungroup must actually mutate state when invoked.
 *
 * Context: T3 migrated these actions to descriptor + bridge pattern. T8 was
 * supposed to wire the descriptor invokers through DepSchema, but those deps
 * aren't in the schema yet. This suite confirms the BRIDGE's run path is
 * functional (not delegating to the stub invoker).
 */
import { describe, it, expect, vi } from 'vitest';
import { defaultDeleteAction } from './delete';
import { defaultDuplicateAction } from './duplicate';
import { defaultGroupAction, defaultUngroupAction } from './group';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { Group } from 'features/groups/types';
import type { Op } from 'core/ops/types';

describe('Phase 4 T8 regression — bridge run bodies', () => {
  // ── delete ─────────────────────────────────────────────────────────────────

  describe('defaultDeleteAction', () => {
    it('run() actually calls applyOps with delete + clear-selection ops', () => {
      const scene = [{ id: 'a' }, { id: 'b' }];
      const applyOps = vi.fn((ops: Op[], _label?: string) => {
        // Simulate: apply each op against a minimal adapter.
        const adapter = {
          removeNode: (id: string) => {
            const i = scene.findIndex((n) => n.id === id);
            if (i >= 0) scene.splice(i, 1);
          },
          setSelection: vi.fn(),
        };
        for (const op of ops) op.apply(adapter);
      });

      const action = defaultDeleteAction({
        getSelection: () => [asNodeId('a')],
        getNodeIndex: () => 0,
        getNode: (id) => scene.find((n) => n.id === id) ?? null,
        applyOps,
      });

      action.run!();

      expect(applyOps).toHaveBeenCalledOnce();
      expect(scene.map((n) => n.id)).toEqual(['b']);
    });

    it('run() is a no-op when selection is empty — bridge guards correctly', () => {
      const applyOps = vi.fn();
      defaultDeleteAction({
        getSelection: () => [],
        getNodeIndex: () => -1,
        applyOps,
      }).run!();
      expect(applyOps).not.toHaveBeenCalled();
    });

    it('bridge does not carry invoker (legacy run path stays active)', () => {
      const a = defaultDeleteAction({
        getSelection: () => [],
        getNodeIndex: () => -1,
        applyOps: vi.fn(),
      });
      expect(a.invoker).toBeUndefined();
      expect(typeof a.run).toBe('function');
    });
  });

  // ── duplicate ───────────────────────────────────────────────────────────────

  describe('defaultDuplicateAction', () => {
    it('run() clones each selected node and dispatches insert + select ops', () => {
      const inserted: string[] = [];
      const applyOps = vi.fn((ops: Op[]) => {
        const adapter = {
          insertNode: (n: { id: string }) => inserted.push(n.id),
          setSelection: vi.fn(),
        };
        for (const op of ops) op.apply(adapter);
      });
      const cloneNode = (id: NodeId) => ({ id: asNodeId(id + "'") });

      defaultDuplicateAction({
        getSelection: () => [asNodeId('x'), asNodeId('y')],
        cloneNode,
        applyOps,
      }).run!();

      expect(applyOps).toHaveBeenCalledOnce();
      expect(inserted).toEqual(["x'", "y'"]);
    });

    it('run() passes default offset {dx:8, dy:8} to cloneNode', () => {
      const clone = vi.fn((id: NodeId) => ({ id: asNodeId(id + "'") }));
      defaultDuplicateAction({
        getSelection: () => [asNodeId('n')],
        cloneNode: clone,
        applyOps: vi.fn(),
      }).run!();
      expect(clone).toHaveBeenCalledWith('n', { dx: 8, dy: 8 });
    });

    it('run() is a no-op on empty selection', () => {
      const applyOps = vi.fn();
      defaultDuplicateAction({
        getSelection: () => [],
        cloneNode: vi.fn(),
        applyOps,
      }).run!();
      expect(applyOps).not.toHaveBeenCalled();
    });

    it('bridge does not carry invoker', () => {
      const a = defaultDuplicateAction({
        getSelection: () => [],
        cloneNode: vi.fn(),
        applyOps: vi.fn(),
      });
      expect(a.invoker).toBeUndefined();
      expect(typeof a.run).toBe('function');
    });
  });

  // ── group ───────────────────────────────────────────────────────────────────

  describe('defaultGroupAction', () => {
    it('run() dispatches a CreateGroupOp + SetSelectionOp for ≥2 selection', () => {
      const groupIds: string[] = [];
      const newSel: string[][] = [];
      const applyOps = vi.fn((ops: Op[]) => {
        const adapter = {
          insertGroup: (g: Group) => groupIds.push(g.id),
          setSelection: (ids: string[]) => newSel.push(ids),
        };
        for (const op of ops) op.apply(adapter);
      });

      defaultGroupAction({
        getSelection: () => [asNodeId('a'), asNodeId('b')],
        applyOps,
        newGroupId: () => 'g1',
      }).run!();

      expect(applyOps).toHaveBeenCalledOnce();
      expect(groupIds).toContain('g1');
      // After grouping, selection becomes the group id.
      expect(newSel.at(-1)).toEqual(['g1']);
    });

    it('run() is a no-op below minMembers', () => {
      const applyOps = vi.fn();
      defaultGroupAction({
        getSelection: () => [asNodeId('solo')],
        applyOps,
      }).run!();
      expect(applyOps).not.toHaveBeenCalled();
    });

    it('bridge does not carry invoker', () => {
      const a = defaultGroupAction({ getSelection: () => [], applyOps: vi.fn() });
      expect(a.invoker).toBeUndefined();
      expect(typeof a.run).toBe('function');
    });
  });

  // ── ungroup ─────────────────────────────────────────────────────────────────

  describe('defaultUngroupAction', () => {
    it('run() dissolves selected groups and expands selection to members', () => {
      const g1: Group = { id: 'g1', members: ['a', 'b', 'c'] };
      const dissolved: string[] = [];
      const newSel: string[][] = [];
      const applyOps = vi.fn((ops: Op[]) => {
        const adapter = {
          removeGroup: (id: string) => dissolved.push(id),
          setSelection: (ids: string[]) => newSel.push(ids),
        };
        for (const op of ops) op.apply(adapter);
      });

      defaultUngroupAction({
        getSelection: () => [asNodeId('g1')],
        getGroup: (id) => (id === 'g1' ? g1 : undefined),
        applyOps,
      }).run!();

      expect(applyOps).toHaveBeenCalledOnce();
      expect(dissolved).toContain('g1');
      expect(newSel.at(-1)).toEqual(['a', 'b', 'c']);
    });

    it('run() is a no-op when nothing in selection is a group', () => {
      const applyOps = vi.fn();
      defaultUngroupAction({
        getSelection: () => [asNodeId('leaf')],
        getGroup: () => undefined,
        applyOps,
      }).run!();
      expect(applyOps).not.toHaveBeenCalled();
    });

    it('bridge does not carry invoker', () => {
      const a = defaultUngroupAction({
        getSelection: () => [],
        getGroup: () => undefined,
        applyOps: vi.fn(),
      });
      expect(a.invoker).toBeUndefined();
      expect(typeof a.run).toBe('function');
    });
  });
});
