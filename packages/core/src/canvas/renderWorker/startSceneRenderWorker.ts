/**
 * The page's side of worker rendering. It hands the canvas to the worker, and on each frame its
 * host asks for sends only what changed: the scene's changed nodes in their saved form, its pose
 * overrides, and the view, size and layer settings. No draw command crosses but the caller's own
 * `extraCommands`. Hit-testing, input and overlays stay on the page, which still holds the scene.
 */
import { createEmitter } from '@weasel-js/registry';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Scene } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { resolveDpr } from '../canvasRenderer';
import type { SceneViewLayers } from '../sceneViewRender';
import type { FromWorker, ToWorker } from './protocol';
import { createFrameWriter } from './frameWriter';
import { answerImage } from './workerImages';

/** What a worker frame paints, beside the scene. */
export interface SceneRenderInputs<TData, TLayer extends string, TPose> extends SceneViewLayers {
  scene: Scene<TData, TLayer, TPose>;
  view: View;
  /** CSS pixels. */
  width: number;
  height: number;
  /** Default `devicePixelRatio`, read per frame. */
  dpr?: number;
  /** Skip what cannot reach the view, as `<SceneViewCanvas cull>`. */
  cull?: boolean;
  /** World-space commands drawn over the scene. These cross whole, each time the array changes. */
  extraCommands?: readonly DrawCommand[];
}

/** A scene painted by a worker into a canvas the page handed it. */
export interface SceneRenderWorker<TData, TLayer extends string, TPose> {
  /** Change what the next frame paints. Fields left out keep their value. */
  update(inputs: Partial<SceneRenderInputs<TData, TLayer, TPose>>): void;
  /** Send the worker what changed and ask it for a frame. Call from a frame loop that stops
   *  while nothing can see the canvas. With a frame still in flight it sends nothing, and the
   *  worker's answer asks for another. Returns `false` once disposed. */
  sync(): boolean;
  /** Hear when a frame is due: the scene or its overrides changed, or the worker's own pixels
   *  did. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** What the canvas shows now. `null` when it shows nothing yet. */
  snapshot(): Promise<ImageBitmap | null>;
  /** Stop the worker, and with it the canvas's context. */
  dispose(): void;
}

/** Start painting `inputs.scene` into `canvas` from `worker`, a worker whose module calls
 *  `serveSceneRender`. The canvas is the worker's from here on: the page can no longer open a
 *  context on it or set its size attributes. */
export function startSceneRenderWorker<TData, TLayer extends string, TPose>(
  worker: Worker,
  canvas: HTMLCanvasElement,
  initial: SceneRenderInputs<TData, TLayer, TPose>,
): SceneRenderWorker<TData, TLayer, TPose> {
  let inputs = initial;
  const frames = createFrameWriter();
  const due = createEmitter();
  let inFlight = false;
  let owed = false;
  let disposed = false;
  let warned = false;
  const snapshots = new Map<number, (b: ImageBitmap | null) => void>();
  let nextSnapshot = 0;
  const imageWaits = new Set<() => void>();
  const post = (msg: ToWorker, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);

  let unwatch = () => {};
  const watch = () => {
    unwatch();
    const { scene } = inputs;
    const offScene = scene.subscribe(due.emit);
    const offOverrides = scene.overrides.subscribe(() => { frames.overridesChanged(); due.emit(); });
    unwatch = () => { offScene(); offOverrides(); };
  };
  watch();

  worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
    const msg = event.data;
    if (msg.type === 'drawn') {
      inFlight = false;
      if (owed) { owed = false; due.emit(); }
    } else if (msg.type === 'dirty') due.emit();
    else if (msg.type === 'snapshot') {
      snapshots.get(msg.id)?.(msg.bitmap);
      snapshots.delete(msg.id);
    } else if (msg.type === 'image') {
      const stop = answerImage(msg, (answer) => { imageWaits.delete(stop); post(answer); });
      imageWaits.add(stop);
    } else if (msg.type === 'error' && !warned) {
      warned = true;
      console.warn('weasel: the render worker failed:', msg.message);
    }
  });

  worker.addEventListener('error', (event) => {
    if (warned) return;
    warned = true;
    console.warn('weasel: the render worker did not start:', event.message);
  });

  const dpr = resolveDpr(initial.dpr);
  const offscreen = canvas.transferControlToOffscreen();
  post({ type: 'init', canvas: offscreen, width: initial.width, height: initial.height, dpr }, [offscreen]);

  return {
    update(next) {
      const sceneMoved = next.scene !== undefined && next.scene !== inputs.scene;
      inputs = { ...inputs, ...next };
      if (sceneMoved) {
        frames.forgetScene();
        watch();
      }
    },
    sync() {
      if (disposed) return false;
      if (inFlight) { owed = true; return true; }
      const msg = frames.write(inputs as unknown as SceneRenderInputs<unknown, string, unknown>);
      inFlight = true;
      post(msg);
      return true;
    },
    subscribe: due.subscribe,
    snapshot() {
      if (disposed) return Promise.resolve(null);
      const id = ++nextSnapshot;
      return new Promise((resolve) => {
        snapshots.set(id, resolve);
        post({ type: 'snapshot', id });
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unwatch();
      for (const stop of imageWaits) stop();
      for (const resolve of snapshots.values()) resolve(null);
      snapshots.clear();
      worker.terminate();
    },
  };
}
