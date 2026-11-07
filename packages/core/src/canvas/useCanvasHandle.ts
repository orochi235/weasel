import { useCallback, useImperativeHandle, useRef } from 'react';
import type React from 'react';
import type { View } from 'core/viewport/view';
import type { Dims } from 'core/layers/render';
import type { CanvasExtensionApi } from './canvasExtension';
import type { IdBuffer } from '@weasel-js/renderer';
import type { CanvasElements } from './useCanvasElements';
import type { HitTestExtrasIn } from './useExtraLayers';
import type { SurfaceFrame } from './useViewRegistrySurface';

const NO_IDS: IdBuffer = Object.freeze({ x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) });

/** How the handle reads the ids of the canvas's last frame; the paint publishes them. */
export type IdReaders = Pick<CanvasExtensionApi, 'readIds' | 'readIdsSync'>;

const NO_READERS: IdReaders = { readIds: () => Promise.resolve(NO_IDS), readIdsSync: () => NO_IDS };

/** The handle's members the canvas builds elsewhere. */
export type CanvasHandleApi = Omit<
  CanvasExtensionApi,
  'element' | 'surface' | 'getSurfaceRect' | 'hitTestExtras' | 'ingest' | 'addView' | 'pickAt' | 'readIds' | 'readIdsSync'
> & { hitTestExtrasIn: HitTestExtrasIn };

/** The elements the handle names, as of this render. */
export interface CanvasHandleTarget
  extends Pick<CanvasElements, 'canvasRef' | 'ownCanvasRef' | 'detached' | 'paintRectRef'> {
  inputElement: HTMLElement | null | undefined;
  paintCanvas: HTMLCanvasElement | null | undefined;
}

/** The bare canvas's imperative handle. Its own-frame members answer against `frame`.
 *  Returns where the paint publishes the handle's `readIds`, which needs its last frame. */
export function useCanvasHandle(
  ref: React.ForwardedRef<CanvasExtensionApi>,
  target: CanvasHandleTarget,
  frame: SurfaceFrame,
  api: CanvasHandleApi,
): { current: IdReaders } {
  const { canvasRef, ownCanvasRef, detached, paintRectRef, inputElement, paintCanvas } = target;
  const { viewRef, dimsRef, helpersRef } = frame;
  const {
    hitTestExtrasIn, clientToWorld, requestRedraw, subscribeFrame, subscribeBeforePaint,
    subscribeResume, registerLayer, getView, setView, subscribeView,
    getPaintedVersion, paintedCursor, cursorSink, getDebug,
  } = api;
  const readIdsRef = useRef<IdReaders>(NO_READERS);
  const readIds = useCallback<CanvasExtensionApi['readIds']>((rect, options) => readIdsRef.current.readIds(rect, options), []);
  const readIdsSync = useCallback<CanvasExtensionApi['readIdsSync']>(
    (rect, options) => readIdsRef.current.readIdsSync(rect, options), []);
  const pickAt = useCallback<CanvasExtensionApi['pickAt']>(
    async (x, y, options) => (await readIdsRef.current.readIds({ x, y, width: 0, height: 0 }, options)).data[0] ?? 0, []);

  const hitTestExtras = useCallback((worldX: number, worldY: number, at?: { view: View; dims: Dims }) => (
    hitTestExtrasIn(worldX, worldY, at?.view ?? viewRef.current, at?.dims ?? dimsRef.current, helpersRef.current)
  ), [hitTestExtrasIn, dimsRef, viewRef, helpersRef]);

  const getSurfaceRect = useCallback(() => {
    const origin = paintRectRef.current;
    const { width: w, height: h } = dimsRef.current;
    return { x: origin?.x ?? 0, y: origin?.y ?? 0, width: w, height: h };
  }, [dimsRef, paintRectRef]);

  useImperativeHandle(ref, () => ({
    // Named rather than read off `canvasRef` so the handle rebuilds when a
    // detached surface's input element arrives, which is a render later.
    element: detached ? inputElement ?? null : canvasRef.current,
    surface: detached ? paintCanvas ?? null : ownCanvasRef.current,
    getSurfaceRect,
    clientToWorld,
    requestRedraw,
    subscribeFrame,
    subscribeBeforePaint,
    subscribeResume,
    registerLayer,
    hitTestExtras,
    getView,
    setView,
    subscribeView,
    getPaintedVersion,
    paintedCursor,
    cursorSink,
    getDebug,
    pickAt,
    readIds,
    readIdsSync,
  }), [canvasRef, ownCanvasRef, detached, inputElement, paintCanvas,
       getSurfaceRect, clientToWorld, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume,
       registerLayer,
       hitTestExtras, getView, setView, subscribeView, getPaintedVersion,
       paintedCursor, cursorSink, getDebug, pickAt, readIds, readIdsSync]);
  return readIdsRef;
}
