import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { Paint } from '@weasel-js/paint';
import { createBackgroundFillLayer } from 'core/layers/backgroundFill';
import { composeOrderedLayers, placeToolOverlays } from './layerOrder';
import { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
import type { CanvasProps } from './canvasProps';
import type { ViewRegistry } from './viewRegistry';

/** The `layers` prop's slots and custom entries in draw order, with the background fill beneath,
 *  the decoration layer above, and the active tool's overlays placed among them. */
export function useSlotLayers(
  layersMap: CanvasProps<unknown>['layers'],
  tools: CanvasProps<unknown>['tools'],
  backgroundFill: Paint | undefined,
  decorationLayer: RenderLayer<unknown> | undefined,
): RenderLayer<unknown>[] {
  const backgroundLayer = useMemo(
    () => (backgroundFill ? createBackgroundFillLayer(backgroundFill) : undefined),
    [backgroundFill],
  );

  return useMemo<RenderLayer<unknown>[]>(() => {
    const standardLayers: Partial<
      Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>
    > = {};
    for (const slot of ['grid', 'cellHighlight', 'selectionOverlay'] as const) {
      const entry = layersMap[slot];
      if (isCustomEntry(entry)) standardLayers[slot] = entry.layer;
    }
    const out: RenderLayer<unknown>[] = composeOrderedLayers(
      decorationLayer ? { ...layersMap, decorationLayer: { layer: decorationLayer } } : layersMap,
      standardLayers, layersMap.scene?.layers, backgroundLayer,
    );
    if (tools) {
      placeToolOverlays(out, standardLayers.selectionOverlay, tools.getActiveOverlays);
    }
    return out;
  }, [layersMap, tools, backgroundLayer, decorationLayer]);
}

/** What the canvas paints on top of its slot layers. */
export interface StackAbove {
  viewRegistry: ViewRegistry | null;
  debugOverlay: RenderLayer<unknown> | null | undefined;
  /** Registered layers; re-read whenever `extrasVersion` changes. */
  extrasRef: { readonly current: ReadonlySet<RenderLayer<unknown>> };
  extrasVersion: number;
  cursorLayer: RenderLayer<unknown>;
}

/**
 * The full stack the canvas paints: its slot layers, then registered views, the debug overlay,
 * externally registered layers, and the cursor. Every layer that can change on its own
 * repaints the canvas through `requestRedraw`.
 */
export function useComposedLayers(
  layers: readonly RenderLayer<unknown>[],
  above: StackAbove,
  requestRedraw: () => void,
): RenderLayer<unknown>[] {
  const { viewRegistry, debugOverlay, extrasRef, extrasVersion, cursorLayer } = above;
  const viewRegistryVersion = useSyncExternalStore(
    useCallback((cb: () => void) => viewRegistry?.subscribe(cb) ?? (() => {}), [viewRegistry]),
    () => viewRegistry?.getVersion() ?? 0,
    () => 0,
  );

  const composed = useMemo(() => {
    // Views paint through the surface's own stack, so they sit above it and
    // below both the debug overlay and externally-registered layers.
    const withViews = viewRegistry
      ? [...layers, ...viewRegistry.list().filter((r) => r.paint).map((r) => r.layer as RenderLayer<unknown>)]
      : layers;
    const base = debugOverlay ? [...withViews, debugOverlay] : withViews;
    // The cursor goes last: it is the one thing that is always in front of
    // everything, including a consumer's own registered layers.
    return [...base, ...extrasRef.current, cursorLayer];
    // extrasVersion drives re-reads of extrasRef when layers are registered/detached;
    // viewRegistryVersion does the same for registered views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, debugOverlay, extrasVersion, viewRegistry, viewRegistryVersion,
      cursorLayer]);

  useEffect(() => {
    const redraw = (): void => { requestRedraw(); };
    const offs: (() => void)[] = [];
    for (const layer of composed) if (layer.subscribe) offs.push(layer.subscribe(redraw));
    return () => { for (const off of offs) off(); };
  }, [composed, requestRedraw]);

  return composed;
}
