/**
 * The page's side of worker rendering. It hands the canvas to the worker, and on each frame its
 * host asks for sends only what changed: the scene's changed nodes in their saved form, its pose
 * overrides, and the view, size and layer settings. No draw command crosses but the caller's own
 * `extraCommands`. Hit-testing, input and overlays stay on the page, which still holds the scene.
 */
import { createEmitter } from '@weasel-js/registry';
import type { DrawCommand, IdBuffer } from '@weasel-js/renderer';
import type { Scene } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import type { CanvasIdReadOptions } from '../canvasExtension';
import { resolveDpr } from '../canvasRenderer';
import type { SceneViewLayers } from '../sceneViewRender';
import type { FromWorker, ToWorker } from './protocol';
import { createFrameWriter } from './frameWriter';
import { createFrameSync } from './frameSync';
import { createRequests } from './requests';
import {
  DEFAULT_WORKER_TIMEOUT, watchWorkerHealth, type RenderWorkerOptions, type RenderWorkerStatus,
} from './workerHealth';
import { workerAnimator, type WorkerAnimator } from './workerAnimator';
import { answerImage } from './workerImages';
import type { Rect } from '@weasel-js/geom';

/** What the worker's animator follows of a page clock: a `ClockHandle` from `@weasel-js/clock`. */
export interface FollowedClock {
  clock: { readonly elapsed: number; readonly rate: number; subscribe(fn: () => void): () => void };
  onFrame(fn: () => void): () => void;
}

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
  /** A per-node alpha multiplier, as `<SceneViewCanvas alphaFor>`. Called on the page for every
   *  node each frame; only the alphas that changed cross. */
  alphaFor?: (id: string) => number;
  /** A page clock the worker's animator follows, as `useAnimator({ clock })` does: its pause,
   *  rate and seeks reach the animations. Without one the animator runs on the page's frame times. */
  clock?: FollowedClock;
  /** World-space commands drawn over the scene. These cross whole, each time the array changes. */
  extraCommands?: readonly DrawCommand[];
}

/** A scene painted by a worker into a canvas the page handed it. */
export interface SceneRenderWorker<TData, TLayer extends string, TPose> {
  /** Change what the next frame paints. Fields left out keep their value. */
  update(inputs: Partial<SceneRenderInputs<TData, TLayer, TPose>>): void;
  /** Send the worker what changed and ask it for a frame. Call from a frame loop that stops
   *  while nothing can see the canvas. With a frame still in flight it sends nothing, and the
   *  worker's answer asks for another; a frame unanswered for the timeout counts as lost, and
   *  the next one carries everything. Returns `false` once failed or disposed. */
  sync(): boolean;
  /** Hear when a frame is due: the scene or its overrides changed, or the worker's own pixels
   *  did. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** The worker's animator, which plays the programs its module registered. */
  readonly animator: WorkerAnimator;
  /** The host's frame loop is back after time nobody saw: the worker's animator does not count it,
   *  unless it follows a clock, whose position stands whatever the frame loop missed. */
  resumed(): void;
  /** The `pickId`s the worker's last frame painted over `rect`, CSS pixels from the canvas's
   *  top-left: `WeaselRenderer.renderIds` on that frame, a round trip away. `null` when there is
   *  no answer: before the first frame, once failed or disposed, after the timeout, or when an
   *  error in the worker lost it. */
  readIds(rect: Rect, options?: CanvasIdReadOptions): Promise<IdBuffer | null>;
  /** What the canvas shows now. `null` when it shows nothing yet, or there is no answer, as for
   *  `readIds`. */
  snapshot(): Promise<ImageBitmap | null>;
  /** How the worker stands. A failed worker is terminated already, and paints nothing more. */
  readonly status: RenderWorkerStatus;
  /** Hear when `status` changes. Returns an unsubscribe. */
  subscribeStatus(fn: () => void): () => void;
  /** Stop the worker, and with it the canvas's context. */
  dispose(): void;
}

/** Ask for a frame whenever the scene, its overrides or scroll offsets, or the clock move. */
function watchInputs(
  inputs: SceneRenderInputs<unknown, string, unknown>, due: () => void, overridesChanged: () => void,
): () => void {
  const { scene, clock } = inputs;
  const offClock = clock ? [clock.clock.subscribe(due), clock.onFrame(due)] : [];
  const offScene = scene.subscribe(due);
  const offOverrides = scene.overrides.subscribe(() => { overridesChanged(); due(); });
  const offScroll = scene.scroll.subscribe(due);
  return () => { offScene(); offOverrides(); offScroll(); for (const off of offClock) off(); };
}

/** Answer the worker's request for an image from the page's cache, unless `onDispose` fires first. */
function answerFromPage(
  request: Extract<FromWorker, { type: 'image' }>,
  post: (msg: ToWorker, transfer: Transferable[]) => void,
  onDispose: (fn: () => void) => () => void,
): void {
  let answered = false;
  let unhook = () => {};
  const stop = answerImage(request, (answer) => {
    answered = true;
    unhook();
    post(answer, answer.bitmap ? [answer.bitmap] : []);
  });
  if (!answered) unhook = onDispose(stop);
}

/** A warning that says each different thing once, so a worker that fails the same way every
 *  frame warns once, and a new failure still warns. */
function onceEach(): (what: string, detail: unknown) => void {
  const warned = new Set<string>();
  return (what, detail) => {
    const key = `${what} ${String(detail)}`;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`weasel: ${what}`, detail);
  };
}

/** Start painting `inputs.scene` into `canvas` from `worker`, a worker whose module calls
 *  `serveSceneRender`. The canvas is the worker's from here on: the page can no longer open a
 *  context on it or set its size attributes.
 *
 *  The client owns `worker` from the call: `dispose` terminates it, and so does a setup that
 *  throws, which rethrows its own error and leaves nothing watching. A canvas whose transfer went
 *  through before the throw cannot be handed over again.
 *
 *  Every request waits at most `options.timeout`. An error the worker raises after it started
 *  answers what was waiting as missing and lets later frames through; a worker that never
 *  started, cannot open a context, or stays silent through a ping fails for good: `status` says
 *  why, and the client releases what it holds. Restart with a new canvas and a new call. */
export function startSceneRenderWorker<TData, TLayer extends string, TPose>(
  worker: Worker,
  canvas: HTMLCanvasElement,
  initial: SceneRenderInputs<TData, TLayer, TPose>,
  options: RenderWorkerOptions = {},
): SceneRenderWorker<TData, TLayer, TPose> {
  const timeout = options.timeout ?? DEFAULT_WORKER_TIMEOUT;
  let inputs = initial;
  const frames = createFrameWriter();
  const due = createEmitter();
  let stopped = false;
  const warnOnce = onceEach();
  const post = (msg: ToWorker, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);
  const overdue = () => health.overdue();
  const frameAcks = createRequests<boolean>({ missing: () => false, timeout, onTimeout: overdue });
  const snapshots = createRequests<ImageBitmap | null>({ missing: () => null, timeout, onTimeout: overdue });
  const idReads = createRequests<IdBuffer | null>({ missing: () => null, timeout, onTimeout: overdue });
  /** Each image request still waiting on the page's cache hears this to stop. */
  const disposing = createEmitter();
  let unwatch = () => {};
  const watch = () => {
    unwatch();
    unwatch = watchInputs(inputs, due.emit, frames.overridesChanged);
  };
  const lost = () => { frameAcks.drain(); snapshots.drain(); idReads.drain(); };
  const release = () => {
    stopped = true;
    unwatch();
    disposing.emit();
    lost();
  };
  const health = watchWorkerHealth(worker, { timeout, post, warn: warnOnce, fatal: release, lost });

  const frameSync = createFrameSync({ frames, acks: frameAcks, post, due: due.emit, warn: warnOnce, stopped: () => stopped });
  const animator = workerAnimator((op) => {
    if (stopped) return;
    frameSync.queue(op);
    due.emit();
  });

  worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
    if (stopped) return;
    const msg = event.data;
    if (msg.type === 'drawn') frameAcks.settle(msg.id, true);
    else if (msg.type === 'dirty') due.emit();
    else if (msg.type === 'snapshot') snapshots.settle(msg.id, msg.bitmap);
    else if (msg.type === 'ids') idReads.settle(msg.id, msg.ids);
    else if (msg.type === 'image') answerFromPage(msg, post, disposing.subscribe);
  });

  try {
    const dpr = resolveDpr(initial.dpr);
    const offscreen = canvas.transferControlToOffscreen();
    post({ type: 'init', canvas: offscreen, width: initial.width, height: initial.height, dpr }, [offscreen]);
    watch();
  } catch (e) {
    stopped = true;
    unwatch();
    worker.terminate();
    throw e;
  }

  return {
    update(next) {
      if (stopped) return;
      const sceneMoved = next.scene !== undefined && next.scene !== inputs.scene;
      const clockMoved = 'clock' in next && next.clock !== inputs.clock;
      inputs = { ...inputs, ...next };
      if (sceneMoved) frames.forgetScene();
      if (sceneMoved || clockMoved) watch();
      // The last frame's time stands on the old clock's timeline, or the page's.
      if (clockMoved) frameSync.resume();
    },
    sync() {
      if (stopped) return false;
      const { clock } = inputs;
      frameSync.sync(
        () => frames.write(inputs as unknown as SceneRenderInputs<unknown, string, unknown>),
        clock ? { elapsed: clock.clock.elapsed, rate: clock.clock.rate } : { time: performance.now() },
      );
      return true;
    },
    subscribe: due.subscribe,
    animator,
    // On a clock the clock's position is the time, hidden or not, as `useAnimator({ clock })` has it.
    resumed() { if (!inputs.clock) frameSync.resume(); },
    readIds(rect, options) {
      if (stopped) return Promise.resolve(null);
      return idReads.ask((id) => post({
        type: 'readIds', id, rect,
        ...(options?.minAlpha !== undefined ? { minAlpha: options.minAlpha } : {}),
        ...(options?.exclude && options.exclude.size > 0 ? { exclude: [...options.exclude] } : {}),
      }));
    },
    snapshot() {
      if (stopped) return Promise.resolve(null);
      return snapshots.ask((id) => post({ type: 'snapshot', id }));
    },
    get status() { return health.status; },
    subscribeStatus: health.subscribe,
    dispose() {
      if (stopped) return;
      release();
      health.dispose();
      worker.terminate();
    },
  };
}
