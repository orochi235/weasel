import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
  it('picks the first selected polygon-pose node as editingId; relays applyOps', () => {
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
    const dep = (reg.get as any)('editAnchors');
    expect(dep.editingId).toBe('poly');
    expect(dep.getPose('poly')).toEqual({ kind: 'polygon', points: [] });
    dep.applyOps([], 'test');
    expect(applyOps).toHaveBeenCalledWith([], 'test');
  });

  it('editingId is empty string when no polygon node is selected', () => {
    const nodes = new Map<string, any>([
      ['rect', { id: 'rect', kind: 'leaf', pose: { x: 0, y: 0, width: 1, height: 1 }, data: null }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['rect'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: ['rect'] as NodeId[], set: () => {} } as unknown as SelectionApi;
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
    expect((reg.get as any)('editAnchors').editingId).toBe('');
  });
});
