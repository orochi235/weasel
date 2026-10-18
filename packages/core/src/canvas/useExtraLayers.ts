import { useCallback, useRef, useState } from 'react';
import { isLayerPainted, type RenderLayer } from 'core/layers/render';
import type { CanvasProps } from './canvasProps';
import type { SurfaceHandle } from './viewRegistry';

/** Which layers reach the screen, and which chrome within them. */
export type LayerGate = Pick<CanvasProps<unknown>, 'getIsVisible' | 'layerVisibility' | 'layerOrder'>;

export const alwaysVisible = (_id: string): boolean => true;
export const NO_LAYER_VISIBILITY: Record<string, boolean> = {};

/** Hit-test registered layers against a given frame, topmost first. */
export type HitTestExtrasIn = SurfaceHandle['hitTestExtras'];

export interface ExtraLayers {
  /** Registered layers, in registration order. */
  extrasRef: { readonly current: ReadonlySet<RenderLayer<unknown>> };
  /** Bumped on every registration and removal, so a memo reading `extrasRef` re-runs. */
  extrasVersion: number;
  registerLayer(layer: RenderLayer<unknown>): () => void;
  hitTestExtrasIn: HitTestExtrasIn;
}

/** Layers attached from outside the `layers` prop (a HUD, a loupe), and hit-testing over them. */
export function useExtraLayers(gateRef: { readonly current: LayerGate }): ExtraLayers {
  const [extrasVersion, setExtrasVersion] = useState(0);
  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    extrasRef.current.add(layer);
    setExtrasVersion(n => n + 1);
    return () => {
      extrasRef.current.delete(layer);
      setExtrasVersion(n => n + 1);
    };
  }, []);

  // Registration order is draw order, so the last-registered layer gets first
  // refusal. `<SceneCanvas>` folds this into its `affordanceAt` thunk; Canvas
  // has the layers but not the dispatcher.
  const hitTestExtrasIn = useCallback<HitTestExtrasIn>((worldX, worldY, view, dims, data, only) => {
    const layers = [...extrasRef.current].reverse();
    const gate = gateRef.current;
    const isVisible = gate.getIsVisible?.() ?? alwaysVisible;
    const visibility = gate.layerVisibility ?? NO_LAYER_VISIBILITY;
    const order = gate.layerOrder;
    for (const layer of layers) {
      if (!layer.hitTest) continue;
      if (only && !only.includes(layer)) continue;
      if (!isLayerPainted(layer, visibility, order)) continue;
      const hit = layer.hitTest(worldX, worldY, data, view, dims, isVisible);
      if (hit) return { layerId: layer.id, hit };
    }
    return null;
  }, [gateRef]);

  return { extrasRef, extrasVersion, registerLayer, hitTestExtrasIn };
}
