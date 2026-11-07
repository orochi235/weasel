/**
 * `<SceneViewCanvas worker>`: the same read-only scene view, painted by a worker. The page keeps
 * the frame loop, so the worker paints nothing while the canvas is off screen or the tab hidden.
 */
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { assignRef, useLatest } from '@weasel-js/react';
import type { DrawCommand } from '@weasel-js/renderer';
import { normalizeView, type View } from '../../core/viewport/view';
import type { Scene } from '../../core/scene/types';
import { SurfaceCanvas } from '../SurfaceCanvas';
import { useFrameLoop } from '../useFrameLoop';
import { useSurfaceSize, type SurfaceSizeProps } from '../useSurfaceSize';
import type { SceneViewLayers } from '../sceneViewRender';
import { startSceneRenderWorker, type SceneRenderInputs, type SceneRenderWorker } from './startSceneRenderWorker';

/** What a page can ask of a canvas a worker paints. */
export interface WorkerCanvasHandle {
  /** What the canvas shows now: the canvas itself is the worker's, so `toBlob` on it throws. */
  snapshot(): Promise<ImageBitmap | null>;
}

export interface WorkerSceneViewProps<TData, TLayer extends string, TPose> extends SurfaceSizeProps, SceneViewLayers {
  scene: Scene<TData, TLayer, TPose>;
  view: View;
  worker: () => Worker;
  extraCommands?: ReadonlyArray<DrawCommand>;
  cull?: boolean;
  className?: string;
  canvasRef?: Ref<HTMLCanvasElement>;
  workerRef?: Ref<WorkerCanvasHandle>;
  dpr?: number;
}

type AnyWorker = SceneRenderWorker<unknown, string, unknown>;

/** Clients by canvas. A StrictMode remount runs cleanup and setup back to back on the same
 *  element, and a canvas can be transferred only once, so a cleanup lets its client go a task
 *  later and a setup in between takes it back. */
const LIVE = new WeakMap<HTMLCanvasElement, { client: AnyWorker; release?: ReturnType<typeof setTimeout> }>();

function useSceneRenderWorker(
  canvasRef: { readonly current: HTMLCanvasElement | null },
  start: () => Worker,
  inputs: SceneRenderInputs<unknown, string, unknown>,
  onDue: () => void,
  clientRef: { current: AnyWorker | null },
): void {
  const startRef = useLatest(start);
  const inputsRef = useLatest(inputs);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let entry = LIVE.get(canvas);
    if (entry?.release !== undefined) clearTimeout(entry.release);
    else if (!entry) {
      entry = { client: startSceneRenderWorker(startRef.current(), canvas, inputsRef.current) };
      LIVE.set(canvas, entry);
    }
    const held = entry;
    held.release = undefined;
    clientRef.current = held.client;
    const off = held.client.subscribe(onDue);
    onDue();
    return () => {
      off();
      clientRef.current = null;
      held.release = setTimeout(() => {
        LIVE.delete(canvas);
        held.client.dispose();
      }, 0);
    };
  }, [canvasRef, onDue, clientRef, startRef, inputsRef]);
}

export function WorkerSceneView<TData, TLayer extends string, TPose>(
  props: WorkerSceneViewProps<TData, TLayer, TPose>,
) {
  const { scene, extraCommands, layerVisibility, layerOrder, cull, className, canvasRef, workerRef, dpr } = props;
  const view = normalizeView(props.view);
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    localRef.current = el;
    assignRef(canvasRef, el);
  }, [canvasRef]);
  const { width, height } = useSurfaceSize(props, localRef);

  const clientRef = useRef<AnyWorker | null>(null);
  const loop = useFrameLoop(() => (width > 0 && height > 0 && clientRef.current?.sync()) || false, { target: localRef });
  const inputs: SceneRenderInputs<unknown, string, unknown> = {
    scene: scene as unknown as Scene<unknown, string, unknown>,
    view, width, height, dpr, layerVisibility, layerOrder, cull, extraCommands,
  };
  useSceneRenderWorker(localRef, props.worker, inputs, loop.requestRedraw, clientRef);

  // No dependency array: every commit hands the worker what the render read.
  useLayoutEffect(() => {
    clientRef.current?.update(inputs);
    loop.requestRedraw();
  });
  useImperativeHandle(workerRef, () => ({
    snapshot: () => clientRef.current?.snapshot() ?? Promise.resolve(null),
  }), []);

  return (
    <SurfaceCanvas
      ref={setCanvasRef}
      width={props.width}
      height={props.height}
      className={className}
      buffer="worker"
    />
  );
}
