/**
 * `<SceneViewCanvas worker>`: the same read-only scene view, painted by a worker. The page keeps
 * the frame loop, so the worker paints nothing while the canvas is off screen or the tab hidden.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { assignRef, useLatest } from '@weasel-js/react';
import type { DrawCommand } from '@weasel-js/renderer';
import { normalizeView, type View } from '../../core/viewport/view';
import type { Scene } from '../../core/scene/types';
import { SurfaceCanvas } from '../SurfaceCanvas';
import { useFrameLoop } from '../useFrameLoop';
import { useSurfaceSize, type SurfaceSizeProps } from '../useSurfaceSize';
import type { SceneViewLayers } from '../sceneViewRender';
import type { FollowedClock, SceneRenderInputs } from './startSceneRenderWorker';
import { holdRenderWorker, type AnyRenderWorker } from './liveClients';
import { workerAnimator, type WorkerAnimator } from './workerAnimator';

/** What a page can ask of a canvas a worker paints. */
export interface WorkerCanvasHandle {
  /** The worker's animator: play a program the worker module registered, and steer it. */
  readonly animator: WorkerAnimator;
  /** What the canvas shows now: the canvas itself is the worker's, so `toBlob` on it throws. */
  snapshot(): Promise<ImageBitmap | null>;
}

export interface WorkerSceneViewProps<TData, TLayer extends string, TPose> extends SurfaceSizeProps, SceneViewLayers {
  scene: Scene<TData, TLayer, TPose>;
  view: View;
  worker: () => Worker;
  extraCommands?: ReadonlyArray<DrawCommand>;
  alphaFor?: (id: string) => number;
  clock?: FollowedClock;
  cull?: boolean;
  className?: string;
  canvasRef?: Ref<HTMLCanvasElement>;
  workerRef?: Ref<WorkerCanvasHandle>;
  dpr?: number;
}

type AnyWorker = AnyRenderWorker;

/** What `workerRef.animator` answers while no worker runs: calls that go nowhere. */
const IDLE_ANIMATOR = workerAnimator(() => {});

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
    const held = holdRenderWorker(canvas, startRef.current, inputsRef.current);
    clientRef.current = held.client;
    const off = held.client.subscribe(onDue);
    onDue();
    return () => {
      off();
      clientRef.current = null;
      held.release();
    };
  }, [canvasRef, onDue, clientRef, startRef, inputsRef]);
}

export function WorkerSceneView<TData, TLayer extends string, TPose>(
  props: WorkerSceneViewProps<TData, TLayer, TPose>,
) {
  const { scene, extraCommands, alphaFor, clock, layerVisibility, layerOrder, cull, className, canvasRef, workerRef, dpr } = props;
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
    view, width, height, dpr, layerVisibility, layerOrder, cull, extraCommands, alphaFor, clock,
  };
  useSceneRenderWorker(localRef, props.worker, inputs, loop.requestRedraw, clientRef);

  // No dependency array: every commit hands the worker what the render read.
  useLayoutEffect(() => {
    clientRef.current?.update(inputs);
    loop.requestRedraw();
  });
  useEffect(() => loop.subscribeResume(() => clientRef.current?.resumed()), [loop]);
  useImperativeHandle(workerRef, () => ({
    get animator() { return clientRef.current?.animator ?? IDLE_ANIMATOR; },
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
