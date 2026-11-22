/** A pick routed to a declared `<CanvasView>` sees the scene as that view draws it. */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from '../viewRegistry';
import { useScenePickers } from './useScenePickers';

type Pose = { x: number; y: number; width: number; height: number };
const SURFACE: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const INSET: View = { x: 7, y: 9, scale: { x: 2, y: 2 } };
const DIMS = { width: 100, height: 100, dpr: 1 };
const wrapper = ({ children }: { children: ReactNode }) => <ViewRegistryProvider>{children}</ViewRegistryProvider>;

function declare(registry: ViewRegistry, layerIsPainted: (layer: string) => boolean) {
  act(() => {
    registry.attachSurface({
      view: () => SURFACE, dims: () => DIMS, clientToWorld: (x: number, y: number) => [x, y], claimsAbove: () => false,
    } as never);
    registry.register({
      id: 'inset', order: 0, interactive: true, paint: true, held: 'camera',
      layer: { resolvable: () => ({ id: 'inset', view: INSET, rect: { x: 0, y: 0, width: 100, height: 100 } }) },
      layerIsPainted,
    } as never);
  });
}

describe('useScenePickers, a pick asked by a declared view', () => {
  it("judges the view's layers, not the surface's", () => {
    const { result } = renderHook(() => {
      const scene = useScene<object, 'default' | 'notes', Pose>({
        systemLayers: [{ id: 'default' }, { id: 'notes' }],
        initial: [{ id: asNodeId('n'), kind: 'mark', layer: 'notes', pose: { x: 0, y: 0, width: 100, height: 100 }, data: {} }],
      });
      const adapter = useSceneAdapter(scene);
      return { registry: useOptionalViewRegistry()!, pickers: useScenePickers({ scene, adapter, getView: () => SURFACE }) };
    }, { wrapper });
    declare(result.current.registry, (layer) => layer !== 'notes');
    expect(result.current.pickers.pickEveryIn({ x: 50, y: 50 }, null)).toEqual(['n']);
    expect(result.current.pickers.pickEveryIn({ x: 50, y: 50 }, 'inset')).toEqual([]);
  });
});
