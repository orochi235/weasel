import { useCallback, useEffect, useInsertionEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { viewToMat3 } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { drawLayers, type LayerCommandCache, type RenderLayer } from 'core/layers/render';
import type { CanvasDebugSink } from '../debug/types';
import { beginDebugFrame } from '../debug/useDebugSink';
import type { CanvasRendererLease } from './canvasRenderer';
import type { CanvasProps } from './canvasProps';
import type { CanvasElements } from './useCanvasElements';
import { NO_LAYER_VISIBILITY, type LayerGate } from './useExtraLayers';

/** What a frame's paint reads that a React render owns. */
export interface PaintInputs extends Pick<CanvasProps<unknown>, 'dpr' | 'layerGroups' | 'shaders' | 'flattenTolerance'> {
  layers: RenderLayer<unknown>[];
  width: number;
  height: number;
  debugSink: CanvasDebugSink | null;
  frameStats: boolean;
}

/** What a frame's paint reads that changes outside a render. */
export interface PaintFrame {
  inputsRef: { readonly current: PaintInputs };
  viewRef: { readonly current: View };
  gateRef: { readonly current: LayerGate };
  helpersRef: { readonly current: unknown };
}

/**
 * Which content version the last paint showed. `markPainted` records the current one, read
 * from `contentVersion`'s latest committed value.
 */
export function usePaintedVersion(contentVersion: (() => number) | undefined): {
  getPaintedVersion: () => number;
  markPainted: () => void;
} {
  const contentVersionRef = useLatest(contentVersion);
  const paintedVersionRef = useRef(0);
  const getPaintedVersion = useCallback(() => paintedVersionRef.current, []);
  const markPainted = useCallback(() => {
    paintedVersionRef.current = contentVersionRef.current?.() ?? 0;
  }, [contentVersionRef]);
  return { getPaintedVersion, markPainted };
}

/**
 * Publish the canvas's paint into `paintRef`, which the frame loop calls. The paint binds the
 * leased renderer to whichever canvas pixels go to and draws the layer stack through the
 * current view. The layer command cache lives as long as the canvas.
 */
export function useCanvasPaint(
  paintRef: { current: () => boolean },
  lease: CanvasRendererLease,
  target: Pick<CanvasElements, 'paintTargetRef' | 'ownCanvasRef' | 'paintRectRef'>,
  frame: PaintFrame,
  markPainted: () => void,
): void {
  const { paintTargetRef, ownCanvasRef, paintRectRef } = target;
  const { inputsRef, viewRef, gateRef, helpersRef } = frame;
  const layerCacheRef = useRef<LayerCommandCache>(new Map());

  const paint = useCallback((): boolean => {
    const c = paintTargetRef.current ?? ownCanvasRef.current;
    if (!c) return false;
    const rect = paintRectRef.current;
    const {
      layers: paintLayers, width: w, height: h, debugSink: sink, frameStats: timed,
      dpr: dprIn,
      flattenTolerance: paintFlattenTolerance,
      layerGroups: groups, shaders: paintShaders,
    } = inputsRef.current;
    if (w === 0 || h === 0) return false;

    const debugFrame = beginDebugFrame(sink, timed, paintLayers);

    const renderer = lease.bind(c, { width: w, height: h, dpr: dprIn }, {
      tile: rect,
      flattenTolerance: paintFlattenTolerance,
      shaders: paintShaders,
    });
    // No WebGL2 (jsdom), or a context that is lost for now: nothing to paint.
    if (!renderer) return false;

    const view = viewRef.current;
    const { layerVisibility: vis, layerOrder: order } = gateRef.current;
    const spans = debugFrame?.time();
    const commands = drawLayers(
      paintLayers,
      helpersRef.current,
      vis ?? NO_LAYER_VISIBILITY,
      order,
      view,
      { width: w, height: h },
      layerCacheRef.current,
      undefined,
      groups,
      spans,
    );
    renderer.render(commands, viewToMat3(view), spans ? { spans } : undefined);
    debugFrame?.end(renderer.lastFrameStats());
    markPainted();
    return true;
  }, [gateRef, helpersRef, inputsRef, lease, markPainted, ownCanvasRef, paintRectRef, paintTargetRef, viewRef]);
  useInsertionEffect(() => {
    paintRef.current = paint;
  });

  useEffect(() => {
    const layerCache = layerCacheRef.current;
    return () => { layerCache.clear(); };
  }, []);
}
