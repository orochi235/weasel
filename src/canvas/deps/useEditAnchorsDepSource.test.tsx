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
  it('editingId starts empty; setEditingId(id) drives it; getEditablePath reads + setPreviewPath wins', () => {
    const polyPath = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1, 1]), // M L L
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
    };
    const updateMock = vi.fn();
    const nodes = new Map<string, any>([
      ['poly', { id: 'poly', kind: 'leaf', pose: polyPath, data: null }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['poly'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
      update: updateMock,
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: ['poly'] as NodeId[], set: () => {} } as unknown as SelectionApi;
    const applyOps = vi.fn((ops: { apply(a: unknown): void }[]) => {
      for (const op of ops) op.apply({ setPose: () => {} });
    });
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

    // Activate edit mode.
    act(() => { dep.setEditingId('poly'); });
    dep = (reg.get as any)('editAnchors');
    expect(dep.editingId).toBe('poly');

    // Pose-as-polygon path: getEditablePath returns the node's pose.
    expect(dep.getEditablePath('poly')).toBe(polyPath);

    // Preview wins over committed storage.
    const previewPath = { ...polyPath };
    dep.setPreviewPath('poly', previewPath);
    expect(dep.getEditablePath('poly')).toBe(previewPath);
    dep.setPreviewPath('poly', null);
    expect(dep.getEditablePath('poly')).toBe(polyPath);

    // applyEdit routes through the adapter's applyOps.
    dep.applyEdit('poly', { ...polyPath }, 'Edit anchors');
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0][1]).toBe('Edit anchors');

    // setEditingId(null) clears.
    act(() => { dep.setEditingId(null); });
    expect((reg.get as any)('editAnchors').editingId).toBe('');
  });

  it('clears the effective editingId when the target leaves the selection', () => {
    const nodes = new Map<string, any>([
      ['poly', {
        id: 'poly',
        kind: 'leaf',
        pose: { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array() },
        data: null,
      }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['poly'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
      update: () => {},
    } as unknown as Scene<unknown, string, unknown>;
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
