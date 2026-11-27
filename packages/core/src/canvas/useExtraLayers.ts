import { useCallback, useRef, useState } from 'react';
import { paintedLayers, type RenderLayer } from 'core/layers/render';
import { isVisibleFrom } from './drawEnvelope';
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
  /** Registered layers the surface paints, in the order it paints them. */
  paintedExtras(): RenderLayer<unknown>[];
  hitTestExtrasIn: HitTestExtrasIn;
}

/** Layers attached from outside the `layers` prop (a HUD, a loupe), and
 *  hit-testing over them and then over `slotLayersRef`'s, the slot stack in
 *  paint order: the topmost painted is asked first. */
export function useExtraLayers(
  gateRef: { readonly current: LayerGate },
  slotLayersRef: { readonly current: readonly RenderLayer<unknown>[] },
): ExtraLayers {
  const [extrasVersion, setExtrasVersion] = useState(0);
  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  // One layer object can be registered by several owners; it stays until the
  // last lets go, at the place of its newest registration still held.
  const holdsRef = useRef(new Map<RenderLayer<unknown>, number[]>());
  const seqRef = useRef(0);
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    const holds = holdsRef.current;
    const seq = seqRef.current++;
    holds.set(layer, [...(holds.get(layer) ?? []), seq]);
    extrasRef.current.delete(layer);
    extrasRef.current.add(layer);
    setExtrasVersion(n => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (holds.get(layer) ?? []).filter((s) => s !== seq);
      if (left.length > 0) holds.set(layer, left);
      else holds.delete(layer);
      extrasRef.current = new Set([...holds.keys()].sort((a, b) => holds.get(a)!.at(-1)! - holds.get(b)!.at(-1)!));
      setExtrasVersion(n => n + 1);
    };
  }, []);

  const paintedExtras = useCallback((): RenderLayer<unknown>[] => {
    const gate = gateRef.current;
    return paintedLayers([...extrasRef.current], gate.layerVisibility ?? NO_LAYER_VISIBILITY, gate.layerOrder);
  }, [gateRef]);

  // Registered layers paint above every slot unless `layerOrder` says otherwise;
  // the topmost painted gets first refusal. `<SceneCanvas>` folds this into its
  // `affordanceAt` thunk; Canvas has the layers but not the dispatcher.
  const hitTestExtrasIn = useCallback<HitTestExtrasIn>((worldX, worldY, view, dims, data, only) => {
    const own = [...slotLayersRef.current, ...extrasRef.current];
    const gate = gateRef.current;
    // `only` is the asker's own stack, already gated and ordered by its settings.
    const painted = only
      ? only.filter((layer) => own.includes(layer))
      : paintedLayers(own, gate.layerVisibility ?? NO_LAYER_VISIBILITY, gate.layerOrder);
    const isVisible = isVisibleFrom(data) ?? gate.getIsVisible?.() ?? alwaysVisible;
    for (let i = painted.length - 1; i >= 0; i--) {
      const layer = painted[i]!;
      if (!layer.hitTest) continue;
      const hit = layer.hitTest(worldX, worldY, data, view, dims, isVisible);
      if (hit) return { layerId: layer.id, hit };
    }
    return null;
  }, [gateRef, slotLayersRef]);

  return { extrasRef, extrasVersion, registerLayer, paintedExtras, hitTestExtrasIn };
}
