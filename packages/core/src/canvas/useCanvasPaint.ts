import { useCallback, useEffect, useInsertionEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { viewToMat3, type DrawCommand, type IdBuffer, type WeaselRenderer } from '@weasel-js/renderer';
import type { IdReaders } from './useCanvasHandle';
import type { View } from 'core/viewport/view';
import {
  DEFAULT_LAYER_RETAIN, drawLayers, type LayerCommandCache, type LayerRetainPolicy, type RenderLayer,
} from 'core/layers/render';
import type { CanvasDebugSink } from '../debug/types';
import type { CanvasIdReadOptions } from './canvasExtension';
import { beginDebugFrame } from '../debug/useDebugSink';
import { resolveDpr, type CanvasRendererLease } from './canvasRenderer';
import type { CanvasProps } from './canvasProps';
import type { CanvasElements } from './useCanvasElements';
import { NO_LAYER_VISIBILITY, type LayerGate } from './useExtraLayers';
import { ViewSnap } from './viewSnap';
import type { WorkerStack } from './renderWorker/useWorkerStack';
import type { CanvasWorkerSurface } from './renderWorker/workerStack';

/** What a frame's paint reads that a React render owns. */
export interface PaintInputs extends Pick<CanvasProps<unknown>, 'dpr' | 'layerGroups' | 'shaders' | 'flattenTolerance' | 'imageMinification' | 'retain'> {
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

function retainPolicy(retain: PaintInputs['retain']): LayerRetainPolicy | false {
  if (retain === false) return false;
  const { minCommands, minCommandsWithEffects } = retain ?? {};
  if (minCommands === undefined && minCommandsWithEffects === undefined) return DEFAULT_LAYER_RETAIN;
  return { minCommands: minCommands ?? DEFAULT_LAYER_RETAIN.minCommands, minCommandsWithEffects };
}

/** What a worker-mode paint hands its frame to: `useWorkerStack`'s, with the owner's half. */
export interface PaintStack {
  paint: WorkerStack['paint'];
  paints: (id: string) => boolean;
  inputs: CanvasWorkerSurface['inputs'];
}
const NO_STACK = { current: null };

const NO_IDS: IdBuffer = Object.freeze({ x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) });

type IdRect = { x: number; y: number; width: number; height: number };

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
  requestRedraw: () => void,
  readIdsRef: { current: IdReaders },
  /** In worker mode, the stack the frame is cut across. */
  stackRef: { readonly current: PaintStack | null } = NO_STACK,
): void {
  const { paintTargetRef, ownCanvasRef, paintRectRef } = target;
  const { inputsRef, viewRef, gateRef, helpersRef } = frame;
  const layerCacheRef = useRef<LayerCommandCache>(new Map());
  const snapRef = useRef(new ViewSnap());
  const lastFrameRef = useRef<{ renderer: WeaselRenderer; commands: DrawCommand[]; view: View } | null>(null);

  const paint = useCallback((): boolean => {
    const c = paintTargetRef.current ?? ownCanvasRef.current;
    if (!c) return false;
    const rect = paintRectRef.current;
    const {
      layers: paintLayers, width: w, height: h, debugSink: sink, frameStats: timed,
      dpr: dprIn,
      flattenTolerance: paintFlattenTolerance,
      layerGroups: groups, shaders: paintShaders, retain, imageMinification,
    } = inputsRef.current;
    if (w === 0 || h === 0) return false;

    const debugFrame = beginDebugFrame(sink, timed, paintLayers);

    const renderer = lease.bind(c, { width: w, height: h, dpr: dprIn }, {
      tile: rect,
      flattenTolerance: paintFlattenTolerance,
      retainBudget: retain ? retain.budget : undefined,
      imageMinification,
      shaders: paintShaders,
    });
    // No WebGL2 (jsdom), or a context that is lost for now: nothing to paint.
    if (!renderer) return false;

    const dpr = resolveDpr(dprIn);
    // The renderer's own device pixels to the CSS pixel, from its rounded buffer width.
    const view = snapRef.current.draw(viewRef.current, Math.round(w * dpr) / w, retain !== false && retain?.whole !== false);
    const { layerVisibility: vis, layerOrder: order } = gateRef.current;
    const stack = stackRef.current;
    if (stack) {
      stack.paint({
        layers: paintLayers, helpers: helpersRef.current, visibility: vis ?? NO_LAYER_VISIBILITY, order, view,
        dims: { width: w, height: h, dpr }, cache: layerCacheRef.current, groups, retain: retainPolicy(retain),
        options: { flattenTolerance: paintFlattenTolerance, imageMinification, shaders: paintShaders },
        paints: stack.paints, inputs: stack.inputs(),
      }, renderer);
      debugFrame?.end(renderer.lastFrameStats());
      markPainted();
      return true;
    }
    const spans = debugFrame?.time();
    const commands = drawLayers(
      paintLayers,
      helpersRef.current,
      vis ?? NO_LAYER_VISIBILITY,
      order,
      view,
      { width: w, height: h, dpr },
      layerCacheRef.current,
      undefined,
      groups,
      spans,
      retainPolicy(retain),
    );
    renderer.render(commands, viewToMat3(view), spans ? { spans } : undefined);
    lastFrameRef.current = { renderer, commands, view };
    const stats = renderer.lastFrameStats();
    debugFrame?.end(stats);
    markPainted();
    if (snapRef.current.owesFrame(stats.retained.declined)) requestRedraw();
    return true;
  }, [gateRef, helpersRef, inputsRef, lease, markPainted, ownCanvasRef, paintRectRef, paintTargetRef, requestRedraw, viewRef, stackRef]);
  useInsertionEffect(() => {
    paintRef.current = paint;
  });

  useEffect(() => {
    const layerCache = layerCacheRef.current;
    return () => {
      layerCache.clear();
      lastFrameRef.current = null;
    };
  }, []);

  const readers = useMemo<IdReaders>(() => {
    const live = () => {
      const last = lastFrameRef.current;
      return last && !last.renderer.isContextLost() ? last : null;
    };
    const args = (last: { commands: DrawCommand[]; view: View }, rect: IdRect, options?: CanvasIdReadOptions) =>
      [last.commands, viewToMat3(last.view), { rect, minAlpha: options?.minAlpha, exclude: options?.exclude }] as const;
    return {
      readIds: (rect, options) => {
        const last = live();
        return last ? last.renderer.renderIdsAsync(...args(last, rect, options)) : Promise.resolve(NO_IDS);
      },
      readIdsSync: (rect, options) => {
        const last = live();
        if (!last) return NO_IDS;
        return last.renderer.backend === 'webgpu' ? null : last.renderer.renderIds(...args(last, rect, options));
      },
    };
  }, []);
  useInsertionEffect(() => {
    readIdsRef.current = readers;
  });
}
