import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import {
  createScene, defaultCommitAdapter, createCommitSelectionOps,
  type InsertDep, type NodeId, type RectPose,
} from '@weasel-js/core';
import { useSpiroTool } from './useSpiroTool';
import * as ops from '@weasel-js/core/ops';

describe('useSpiroTool', () => {
  it('selects the curve it inserts in the insert’s own undo entry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const prior = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 } });
    let held: readonly NodeId[] = [prior];
    const selection = {
      get: () => held,
      set: (ids: readonly NodeId[]) => { held = [...ids]; },
    };
    const adapter = defaultCommitAdapter(scene as never, {
      getSelection: () => [...held],
      setSelection: (ids) => { held = [...ids]; },
    });
    const insert: InsertDep = {
      commit(bounds, extras, _ends, select) {
        const id = scene.mintId();
        const node = { id, kind: 'mark', layer: 'main', parent: null, data: extras, pose: bounds };
        scene.applyBatch([ops.insert({ node: node as never }), ...createCommitSelectionOps(select, id)], 'Insert', adapter);
        return id;
      },
    };
    const deps = { insert, operands: selection, view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) } } as unknown as ActionDeps;
    const { result } = renderHook(() => useSpiroTool());
    const run = (id: string, params?: Record<string, unknown>) => {
      const action = result.current.actions!.find((a) => a.id === id)!;
      act(() => { (action.invoker as ImmediateInvoker).run(deps, params); });
    };
    run('spiro.placePoint', { press: { x: 0, y: 0 } });
    run('spiro.placePoint', { press: { x: 50, y: 20 } });
    run('spiro.finish');
    expect(scene.nodes.size).toBe(2);
    const made = [...scene.renderOrder()].find((id) => id !== prior)!;
    expect(held).toEqual([made]);
    scene.undo();
    expect(scene.nodes.size).toBe(1);
    expect(held).toEqual([prior]);
  });

  it('closes on a click as near the first point as the pen\'s close reach', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const committed: unknown[] = [];
    const insert = { commit: (_b: unknown, extras: unknown) => { committed.push(extras); return scene.mintId(); } } as unknown as InsertDep;
    const deps = { insert, operands: { get: () => [], set: () => {} }, view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) } } as unknown as ActionDeps;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KitSettingsProvider value={{ targets: { penCloseHitPx: 20 } }}>{children}</KitSettingsProvider>
    );
    const { result } = renderHook(() => useSpiroTool(), { wrapper });
    const place = (x: number, y: number) => {
      const action = result.current.actions!.find((a) => a.id === 'spiro.placePoint')!;
      act(() => { (action.invoker as ImmediateInvoker).run(deps, { press: { x, y } }); });
    };
    place(0, 0);
    place(100, 0);
    place(50, 80);
    place(15, 0);
    expect(committed).toHaveLength(1);
  });

  it('ends its pointer follow and its cursor\'s snap session when deactivated', () => {
    const insert = { commit: () => 'n' } as unknown as InsertDep;
    let subscribed = 0;
    const pointer = {
      get: () => ({ world: { x: 40, y: 10 } }),
      subscribe: () => { subscribed++; return () => { subscribed--; }; },
    };
    let open = 0;
    const snap = {
      begin: () => {
        open++;
        return { at: (p: { x: number; y: number }) => ({ point: p }), end: () => { open--; } };
      },
    };
    const deps = {
      insert, pointer, snap, operands: { get: () => [], set: () => {} },
      view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) },
    } as unknown as ActionDeps;
    const { result } = renderHook(() => useSpiroTool());
    const place = (x: number, y: number) => {
      const action = result.current.actions!.find((a) => a.id === 'spiro.placePoint')!;
      act(() => { (action.invoker as ImmediateInvoker).run(deps, { press: { x, y } }); });
    };
    place(0, 0);
    place(30, 0);
    expect(subscribed).toBe(1);
    expect(open).toBe(1);
    act(() => { result.current.onDeactivate?.(); });
    expect(subscribed).toBe(0);
    expect(open).toBe(0);
  });
});
