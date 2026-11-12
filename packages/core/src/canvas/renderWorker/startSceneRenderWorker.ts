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
import { createRequests } from './requests';
import type { AnimationOp } from './protocol';
import { workerAnimator, type WorkerAnimator } from './workerAnimator';
import { answerImage } from './workerImages';

const EMPTY_IDS = (): IdBuffer => ({ x: 0, y: 0, width: 0, height: 0, data: new Uint32Array(0) });

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
   *  worker's answer asks for another. Returns `false` once disposed. */
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
   *  top-left: `WeaselRenderer.renderIds` on that frame, a round trip away. Empty before the
   *  first frame and after dispose. */
  readIds(rect: { x: number; y: number; width: number; height: number }, options?: CanvasIdReadOptions): Promise<IdBuffer>;
  /** What the canvas shows now. `null` when it shows nothing yet. */
  snapshot(): Promise<ImageBitmap | null>;
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

/** Watch `worker` for an error before its first message, which means its module never ran:
 *  `fail` runs then, and `failed` answers true from then on. A later error is only warned. */
function watchStartup(worker: Worker, warn: (what: string, detail: unknown) => void, fail: () => void): { failed(): boolean } {
  let started = false;
  let failed = false;
  worker.addEventListener('message', () => { started = true; });
  worker.addEventListener('error', (event) => {
    if (started) return warn('the render worker failed:', event.message);
    failed = true;
    warn('the render worker did not start:', event.message);
    fail();
  });
  return { failed: () => failed };
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
  /** Each failure warned of, so a worker that fails the same way every frame warns once, and a new failure still warns. */
  const warned = new Set<string>();
  const warnOnce = (what: string, detail: unknown) => {
    const key = `${what} ${String(detail)}`;
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`weasel: ${what}`, detail);
  };
  const snapshots = createRequests<ImageBitmap | null>();
  const idReads = createRequests<IdBuffer>();
  /** Each image request still waiting on the page's cache hears this to stop. */
  const disposing = createEmitter();
  const post = (msg: ToWorker, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);

  const ops: AnimationOp[] = [];
  let resumed = false;
  const animator = workerAnimator((op) => {
    if (disposed) return;
    ops.push(op);
    due.emit();
  });

  let unwatch = () => {};
  const watch = () => {
    unwatch();
    unwatch = watchInputs(inputs, due.emit, frames.overridesChanged);
  };
  watch();

  // A worker that never started answers nothing asked of it.
  const startup = watchStartup(worker, warnOnce, () => { snapshots.drain(null); idReads.drain(EMPTY_IDS()); });
  worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
    if (disposed) return;
    const msg = event.data;
    if (msg.type === 'drawn') {
      inFlight = false;
      if (owed) { owed = false; due.emit(); }
    } else if (msg.type === 'dirty') due.emit();
    else if (msg.type === 'snapshot') snapshots.settle(msg.id, msg.bitmap);
    else if (msg.type === 'ids') idReads.settle(msg.id, msg.ids);
    else if (msg.type === 'image') answerFromPage(msg, post, disposing.subscribe);
    else if (msg.type === 'error') warnOnce('the render worker failed:', msg.message);
  });

  const dpr = resolveDpr(initial.dpr);
  const offscreen = canvas.transferControlToOffscreen();
  post({ type: 'init', canvas: offscreen, width: initial.width, height: initial.height, dpr }, [offscreen]);

  return {
    update(next) {
      if (disposed) return;
      const sceneMoved = next.scene !== undefined && next.scene !== inputs.scene;
      const clockMoved = 'clock' in next && next.clock !== inputs.clock;
      inputs = { ...inputs, ...next };
      if (sceneMoved) frames.forgetScene();
      if (sceneMoved || clockMoved) watch();
      // The last frame's time stands on the old clock's timeline, or the page's.
      if (clockMoved) resumed = true;
    },
    sync() {
      if (disposed) return false;
      if (inFlight) { owed = true; return true; }
      const msg = frames.write(inputs as unknown as SceneRenderInputs<unknown, string, unknown>);
      const { clock } = inputs;
      msg.at = clock ? { elapsed: clock.clock.elapsed, rate: clock.clock.rate } : { time: performance.now() };
      if (resumed) msg.resumed = true;
      resumed = false;
      if (ops.length > 0) msg.animations = ops.splice(0);
      try {
        post(msg);
      } catch (e) {
        // Something in the frame cannot be cloned. Nothing of it arrived, so the next frame
        // carries everything, and the animator calls go with it.
        frames.lost();
        if (msg.animations) ops.unshift(...msg.animations);
        if (msg.resumed) resumed = true;
        warnOnce('a frame could not be sent:', e);
        return true;
      }
      inFlight = true;
      return true;
    },
    subscribe: due.subscribe,
    animator,
    // On a clock the clock's position is the time, hidden or not, as `useAnimator({ clock })` has it.
    resumed() { if (!inputs.clock) resumed = true; },
    readIds(rect, options) {
      if (disposed || startup.failed()) return Promise.resolve(EMPTY_IDS());
      return idReads.ask((id) => post({
        type: 'readIds', id, rect,
        ...(options?.minAlpha !== undefined ? { minAlpha: options.minAlpha } : {}),
        ...(options?.exclude && options.exclude.size > 0 ? { exclude: [...options.exclude] } : {}),
      }));
    },
    snapshot() {
      if (disposed || startup.failed()) return Promise.resolve(null);
      return snapshots.ask((id) => post({ type: 'snapshot', id }));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unwatch();
      disposing.emit();
      snapshots.drain(null);
      idReads.drain(EMPTY_IDS());
      worker.terminate();
    },
  };
}
