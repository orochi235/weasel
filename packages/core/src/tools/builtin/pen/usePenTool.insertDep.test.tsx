import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { usePenTool } from './usePenTool';
import type { Tool } from '../../overlayBinding';
import type { Scene } from 'core/scene/types';
import { DepRegistryProvider, useDepRegistry, useDepSource, type DepRegistry } from '@weasel-js/routing/react';
import { buildDepsFromRequires } from '@weasel-js/routing';
import { useInsertDepSource } from 'canvas/deps/insert';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { useEditAnchorsDepSource } from 'canvas/deps/editAnchors';
import { hitTestArea } from 'canvas/deps/hitTestArea';

describe('usePenTool — through the kit insert dep', () => {
  it('inserts a finished path and selects it as one undo step, reading only deps it declares', () => {
    const scene = createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }] }) as unknown as Scene<unknown, string, unknown>;
    const prior = scene.add({ kind: 'mark', layer: 'default', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 } });
    let held: readonly string[] = [prior];
    const selection = {
      get: () => held,
      set: (ids: readonly string[]) => { held = [...ids]; },
      adapterMethods: { getSelection: () => [...held], setSelection: (ids: string[]) => { held = [...ids]; } },
    } as unknown as SelectionApi;
    let reg!: DepRegistry;
    let tool!: Tool;
    function Wire() {
      useInsertDepSource(scene, { applyOps: (ops, label) => scene.applyBatch(ops, label ?? '', defaultCommitAdapter(scene, selection.adapterMethods)) });
      useDepSource('selection', () => selection);
      reg = useDepRegistry();
      tool = usePenTool();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const run = (id: string, params?: Record<string, unknown>) => {
      const action = tool.actions!.find((a) => a.id === id)!;
      if (action.invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
      const invoker = action.invoker;
      act(() => { invoker.run(buildDepsFromRequires(action, reg), params); });
    };
    const before = scene.historyEntries().length;
    run('pen.placeAnchor', { press: { x: 10, y: 20 } });
    run('pen.placeAnchor', { press: { x: 60, y: 20 } });
    run('pen.finish');
    const [, id] = scene.renderOrder();
    const node = scene.get(id)!;
    expect(node.pose).toEqual({ x: 10, y: 20, width: 50, height: 0 });
    expect((node.data as { fill: unknown; stroke: unknown }).fill).toBeNull();
    expect((node.data as { stroke: unknown }).stroke).toBeTruthy();
    expect(held).toEqual([id]);
    expect(scene.historyEntries().length).toBe(before + 1);
    // The selection change is in that step: undo puts back what was selected.
    scene.undo();
    expect(held).toEqual([prior]);
  });

  it('continuing a path selects it in the edit’s own undo step', () => {
    const scene = createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }] }) as unknown as Scene<unknown, string, unknown>;
    const other = scene.add({ kind: 'mark', layer: 'default', data: {}, pose: { x: 500, y: 500, width: 1, height: 1 } });
    let held: readonly string[] = [];
    const selection = {
      get: () => held,
      set: (ids: readonly string[]) => { held = [...ids]; },
      adapterMethods: { getSelection: () => [...held], setSelection: (ids: string[]) => { held = [...ids]; } },
    } as unknown as SelectionApi;
    const adapter = { applyOps: (ops: Parameters<typeof scene.applyBatch>[0], label?: string) => scene.applyBatch(ops, label ?? '', defaultCommitAdapter(scene, selection.adapterMethods)) };
    let reg!: DepRegistry;
    let tool!: Tool;
    function Wire() {
      useInsertDepSource(scene, adapter);
      useEditAnchorsDepSource(scene, selection, adapter);
      useDepSource('selection', () => selection);
      useDepSource('areaSelect', () => ({ hitTestArea: (b: Parameters<typeof hitTestArea>[1]) => hitTestArea(scene, b) }) as never);
      reg = useDepRegistry();
      tool = usePenTool();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const run = (id: string, params?: Record<string, unknown>) => {
      const action = tool.actions!.find((a) => a.id === id)!;
      if (action.invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
      const invoker = action.invoker;
      act(() => { invoker.run(buildDepsFromRequires(action, reg), params); });
    };
    run('pen.placeAnchor', { press: { x: 10, y: 20 } });
    run('pen.placeAnchor', { press: { x: 60, y: 20 } });
    run('pen.finish');
    const [, path] = scene.renderOrder();
    held = [other];
    const before = scene.historyEntries().length;
    run('pen.placeAnchor', { press: { x: 60, y: 20 } });
    run('pen.placeAnchor', { press: { x: 60, y: 80 } });
    run('pen.finish');
    expect([...scene.renderOrder()]).toHaveLength(2);
    expect(held).toEqual([path]);
    expect(scene.historyEntries().length).toBe(before + 1);
    scene.undo();
    expect(held).toEqual([other]);
  });
});
