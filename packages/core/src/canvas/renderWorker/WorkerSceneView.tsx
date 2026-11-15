/**
 * `<SceneViewCanvas worker>`: the same read-only scene view, painted by a worker. The page keeps
 * the frame loop, so the worker paints nothing while the canvas is off screen or the tab hidden.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { assignRef, useLatest } from '@weasel-js/react';
import type { DrawCommand } from '@weasel-js/renderer';
import { normalizeView, type View } from '../../core/viewport/view';
import type { Scene } from '../../core/scene/types';
import { SurfaceCanvas } from '../SurfaceCanvas';
import { useFrameLoop } from '../useFrameLoop';
import { useRedrawOnDensityChange } from '../useCanvasRenderer';
import { useSurfaceSize, type SurfaceSizeProps } from '../useSurfaceSize';
import type { SceneViewLayers } from '../sceneViewRender';
import type { FollowedClock, SceneRenderInputs } from './startSceneRenderWorker';
import { holdRenderWorker, type AnyRenderWorker } from './liveClients';
import { createStatusRelay, type StatusRelay } from './statusRelay';
import { workerAnimator, type WorkerAnimator } from './workerAnimator';
import type { RenderWorkerOptions, RenderWorkerStatus } from './workerHealth';

/** What a page can ask of a canvas a worker paints. */
export interface WorkerCanvasHandle {
  /** The worker's animator: play a program the worker module registered, and steer it. */
  readonly animator: WorkerAnimator;
  /** What the canvas shows now: the canvas itself is the worker's, so `toBlob` on it throws.
   *  `null` when it shows nothing yet, or the worker gave no answer. */
  snapshot(): Promise<ImageBitmap | null>;
  /** How the workers behind the canvas stand: the first failure among them, else starting while
   *  any is, else running. A failed worker paints nothing more until `restart`. */
  readonly status: RenderWorkerStatus;
  /** Hear when `status` changes, across restarts. Returns an unsubscribe. */
  subscribeStatus(fn: () => void): () => void;
  /** Start over: a new canvas element, since a canvas can be handed to a worker only once, and a
   *  new worker from the `worker` prop for it. The old worker stops. */
  restart(): void;
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
  workerTimeout?: RenderWorkerOptions['timeout'];
  dpr?: number;
}

type AnyWorker = AnyRenderWorker;

/** What `workerRef.animator` answers while no worker runs: calls that go nowhere. */
const IDLE_ANIMATOR = workerAnimator(() => {});

interface Held {
  ref: { current: AnyWorker | null };
  relay: StatusRelay;
}

function useSceneRenderWorker(
  canvasRef: { readonly current: HTMLCanvasElement | null },
  start: { worker: () => Worker; timeout: number | undefined },
  inputs: SceneRenderInputs<unknown, string, unknown>,
  onDue: () => void,
  { ref: clientRef, relay }: Held,
): void {
  const startRef = useLatest(start);
  const inputsRef = useLatest(inputs);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { worker, timeout } = startRef.current;
    const held = holdRenderWorker(canvas, worker, inputsRef.current, timeout === undefined ? undefined : { timeout });
    clientRef.current = held.client;
    const off = held.client.subscribe(onDue);
    const offStatus = relay.follow(held.client);
    relay.changed();
    onDue();
    return () => {
      off();
      offStatus();
      clientRef.current = null;
      held.release();
      relay.changed();
    };
  }, [canvasRef, onDue, clientRef, relay, startRef, inputsRef]);
}

/** One canvas and the worker painting it. A restart mounts a new one. */
function WorkerSceneSurface(props: WorkerSceneViewProps<unknown, string, unknown> & { held: Held }) {
  const { scene, extraCommands, alphaFor, clock, layerVisibility, layerOrder, cull, className, canvasRef, dpr, held } = props;
  const view = normalizeView(props.view);
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    localRef.current = el;
    assignRef(canvasRef, el);
  }, [canvasRef]);
  const { width, height } = useSurfaceSize(props, localRef);

  const clientRef = held.ref;
  const loop = useFrameLoop(() => (width > 0 && height > 0 && clientRef.current?.sync()) || false, { target: localRef });
  const inputs: SceneRenderInputs<unknown, string, unknown> = {
    scene, view, width, height, dpr, layerVisibility, layerOrder, cull, extraCommands, alphaFor, clock,
  };
  useSceneRenderWorker(localRef, { worker: props.worker, timeout: props.workerTimeout }, inputs, loop.requestRedraw, held);
  // The frame writer reads the ambient ratio, but only on a frame something else asked for.
  useRedrawOnDensityChange(loop.requestRedraw, dpr);

  // No dependency array: every commit hands the worker what the render read.
  useLayoutEffect(() => {
    clientRef.current?.update(inputs);
    loop.requestRedraw();
  });
  useEffect(() => loop.subscribeResume(() => clientRef.current?.resumed()), [loop, clientRef]);

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

export function WorkerSceneView<TData, TLayer extends string, TPose>(
  props: WorkerSceneViewProps<TData, TLayer, TPose>,
) {
  const { workerRef } = props;
  const [generation, setGeneration] = useState(0);
  const [held] = useState<Held>(() => {
    const ref: Held['ref'] = { current: null };
    return { ref, relay: createStatusRelay(() => (ref.current ? [ref.current] : [])) };
  });
  useImperativeHandle(workerRef, () => ({
    get animator() { return held.ref.current?.animator ?? IDLE_ANIMATOR; },
    snapshot: () => held.ref.current?.snapshot() ?? Promise.resolve(null),
    get status() { return held.relay.status(); },
    subscribeStatus: held.relay.subscribe,
    restart: () => setGeneration((g) => g + 1),
  }), [held]);
  const surface = props as unknown as WorkerSceneViewProps<unknown, string, unknown>;
  return <WorkerSceneSurface key={generation} {...surface} held={held} />;
}
