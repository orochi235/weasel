import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import { createKitSettingsStore, type KitSettingsStore } from '@weasel-js/react';
import { useEditAnchorsDepSource } from './editAnchors';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useEditAnchorsDepSource', () => {
  it('editingId starts empty; setEditingId(id) drives it; getEditablePath reads', () => {
    const polyPath = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1, 1]), // M L L
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
    };
    const updateMock = vi.fn();
    const nodes = new Map<string, any>([
      ['poly', { id: 'poly', kind: 'mark', pose: polyPath, data: null }],
    ]);
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => ['poly'] as NodeId[],
      get: (id: NodeId) => nodes.get(id as string),
      update: updateMock,
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: ['poly'] as NodeId[], set: () => {} } as unknown as SelectionApi;
    const applyOps = vi.fn((ops: { apply(a: unknown): void }[], _label?: string) => {
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
    expect(dep.getStorageKind('poly')).toBe('pose');
    expect(dep.getNodeShape('poly')).toEqual({ pose: polyPath, data: null });

    // applyEdit routes through the adapter's applyOps.
    dep.applyEdit('poly', { ...polyPath }, 'Edit anchors');
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(applyOps.mock.calls[0][1]).toBe('Edit anchors');

    // setEditingId(null) clears.
    act(() => { dep.setEditingId(null); });
    expect((reg.get as any)('editAnchors').editingId).toBe('');
  });

  it('holds the handle locks, starting from the default lock and telling the registry when they change', () => {
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => [] as NodeId[],
      get: () => undefined,
      update: () => {},
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: [] as NodeId[], set: () => {} } as unknown as SelectionApi;
    let lock: 'angle' | 'length' | null = 'length';
    let reg!: DepRegistry;
    function Wire() {
      useEditAnchorsDepSource(scene, sel, { applyOps: () => {} }, undefined, { editAnchors: { params: () => ({ handleLock: lock }) } });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = () => (reg.get as any)('editAnchors');
    expect(dep().handleLocks).toEqual({ angle: false, length: true });
    lock = null;
    expect(dep().handleLocks).toEqual({ angle: false, length: false });

    const heard = vi.fn();
    reg.subscribe!(heard);
    act(() => { dep().setHandleLocks({ angle: true, length: false }); });
    expect(heard).toHaveBeenCalled();
    // Once set, the default no longer decides.
    lock = 'length';
    expect(dep().handleLocks).toEqual({ angle: true, length: false });
  });

  it('reads the handle locks live on a dep taken before they changed, as a drag holds the press\'s', () => {
    const scene = {
      layers: [{ id: 'default' }],
      renderOrder: () => [] as NodeId[],
      get: () => undefined,
      update: () => {},
    } as unknown as Scene<unknown, string, unknown>;
    const sel = { current: [] as NodeId[], set: () => {} } as unknown as SelectionApi;
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
    const atPress = (reg.get as any)('editAnchors');
    expect(atPress.handleLocks).toEqual({ angle: false, length: false });
    act(() => { atPress.setHandleLocks({ angle: true, length: false }); });
    expect(atPress.handleLocks).toEqual({ angle: true, length: false });
  });

  it('clears the effective editingId when the target leaves the selection', () => {
    const nodes = new Map<string, any>([
      ['poly', {
        id: 'poly',
        kind: 'mark',
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

  describe('anchorUnder', () => {
    /** Triangle (0,0)-(10,0)-(10,10) open for edit, under a view of scale `at.scale` and kit settings `at.kit`. */
    function openTriangle(at: { scale?: number; kit?: KitSettingsStore }) {
      const path = {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1]),
        coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      };
      const scene = {
        layers: [{ id: 'default' }],
        renderOrder: () => ['tri'] as NodeId[],
        get: (id: NodeId) => (id === 'tri' ? { id: 'tri', kind: 'mark', pose: path, data: null } : undefined),
        update: () => {},
      } as unknown as Scene<unknown, string, unknown>;
      const sel = { current: ['tri'] as NodeId[], set: () => {} } as unknown as SelectionApi;
      let reg!: DepRegistry;
      function Wire() {
        useEditAnchorsDepSource(scene, sel, { applyOps: () => {} });
        useDepSource('view', () => (at.scale === undefined ? undefined : {
          get: () => ({ x: 0, y: 0, scale: { x: at.scale!, y: at.scale! } }),
        }) as never);
        useDepSource('kitSettings', () => at.kit as never);
        return null;
      }
      render(
        <DepRegistryProvider>
          <Wire />
          <Capture onR={(r) => { reg = r; }} />
        </DepRegistryProvider>,
      );
      act(() => { (reg.get as any)('editAnchors').setEditingId('tri'); });
      return { dep: () => (reg.get as any)('editAnchors') };
    }

    it('is the flat index of the anchor a click lands on, and -1 off every anchor', () => {
      const { dep } = openTriangle({});
      expect(dep().anchorUnder({ x: 10, y: 3 })).toBe(1);
      expect(dep().anchorUnder({ x: 9, y: 9 })).toBe(2);
      expect(dep().anchorUnder({ x: 50, y: 50 })).toBe(-1);
    });

    it('is -1 with no path open', () => {
      const { dep } = openTriangle({});
      act(() => { dep().setEditingId(null); });
      expect(dep().anchorUnder({ x: 10, y: 0 })).toBe(-1);
    });

    it('measures its reach in screen pixels: zoomed in, 5 world units (40 px) misses; zoomed out, 50 (5 px) hits', () => {
      expect(openTriangle({ scale: 8 }).dep().anchorUnder({ x: 15, y: 0 })).toBe(-1);
      expect(openTriangle({ scale: 0.1 }).dep().anchorUnder({ x: 60, y: 0 })).toBe(1);
    });

    it('takes its reach from targets.anchorClickPx', () => {
      const kit = createKitSettingsStore({ targets: { anchorClickPx: 45 } });
      expect(openTriangle({ scale: 8, kit }).dep().anchorUnder({ x: 15, y: 0 })).toBe(1);
    });
  });
});
