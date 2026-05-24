import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useEditAnchorsDepSource } from './useEditAnchorsDepSource';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useEditAnchorsDepSource', () => {
  it('editingId starts empty; setEditingId(id) drives it; getPose + applyOps relay correctly', () => {
    const nodes = new Map<string, any>([
      ['rect', { id: 'rect', kind: 'leaf', pose: { x: 0, y: 0, width: 1, height: 1 }, data: null }],
      ['poly', { id: 'poly', kind: 'leaf', pose: { kind: 'polygon', points: [] }, data: null }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['rect', 'poly'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: ['rect', 'poly'] as NodeId[], set: () => {} } as unknown as SelectionApi;
    const applyOps = vi.fn();
    const adapter = { applyOps };
    let reg!: DepRegistry;
    function Wire() {
      useEditAnchorsDepSource(scene, sel, adapter);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    let dep = (reg.get as any)('editAnchors');
    expect(dep.editingId).toBe('');
    // Explicit activation enters edit mode.
    act(() => { dep.setEditingId('poly'); });
    dep = (reg.get as any)('editAnchors');
    expect(dep.editingId).toBe('poly');
    expect(dep.getPose('poly')).toEqual({ kind: 'polygon', points: [] });
    // Pass-through to adapter for ops.
    dep.applyOps([], 'test');
    expect(applyOps).toHaveBeenCalledWith([], 'test');
    // setEditingId(null) clears.
    act(() => { dep.setEditingId(null); });
    expect((reg.get as any)('editAnchors').editingId).toBe('');
  });

  it('clears the effective editingId when the target leaves the selection', () => {
    const nodes = new Map<string, any>([
      ['poly', { id: 'poly', kind: 'leaf', pose: { kind: 'polygon', points: [] }, data: null }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['poly'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
    } as unknown as Scene<unknown, string, unknown>;
    // Start with poly selected, then drop it.
    const sel = { current: ['poly'] as NodeId[], set: () => {} } as unknown as SelectionApi;
    let reg!: DepRegistry;
    function Wire() {
      useEditAnchorsDepSource(scene, sel, { applyOps: () => {} });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    act(() => { (reg.get as any)('editAnchors').setEditingId('poly'); });
    expect((reg.get as any)('editAnchors').editingId).toBe('poly');
    // Drop selection — the dep should present an empty editingId on next read.
    (sel as unknown as { current: NodeId[] }).current = [] as NodeId[];
    expect((reg.get as any)('editAnchors').editingId).toBe('');
  });
});
