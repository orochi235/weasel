/**
 * Who paints a `<SceneCanvas>`'s scene layers: the page, or a render worker. Either branch names
 * every prop the other forbids, so a prop worker mode cannot honor is a type error, not a no-op.
 */
import type { FollowedClock } from '../renderWorker/startSceneRenderWorker';
import type { CustomLayerEntry } from '../layerSlots';

/** The page paints the scene layers. */
export interface PagePaintedScene {
  worker?: undefined;
  clock?: undefined;
}

/** What the scene slot takes in worker mode: data only, since the worker module's `drawOne`
 *  paints. `ghostAlpha` sets the page-painted ghost of a node in flight. */
export interface WorkerSceneSlot {
  cull?: boolean;
  ghostAlpha?: number;
  objects?: undefined;
  toPose?: undefined;
  drawOne?: undefined;
  drawnPose?: undefined;
  derivedPathOf?: undefined;
  alphaFor?: undefined;
  postProcess?: undefined;
  paintBounds?: undefined;
}

/** A render worker paints the scene layers; the page paints the rest of the stack. */
export interface WorkerPaintedScene {
  /**
   * Start the render worker, whose module calls `serveSceneRender` from
   * `@weasel-js/core/render-worker` and registers what paints a node there. The scene layers paint
   * from it into a canvas handed over with `transferControlToOffscreen`; the layers below and above
   * them (grid, chrome, previews, consumer layers) paint on the page, each run of them its own
   * canvas in one stack. A page layer between two scene layers cuts the scene in two, and each
   * part gets a worker of its own. Called once per such part per mount.
   *
   * The ref's `readIds` and `pickAt` read the worker's ids a round trip away, and `readIdsSync`
   * answers `null`, so `geometry.picking: 'pixels'` walks the shapes. An animation is the worker
   * module's too: play it through the ref's `worker.animator`.
   */
  worker: () => Worker;
  /** A page clock the worker's animator follows: its pause, rate and seeks reach the animations. */
  clock?: FollowedClock;
  /** Not in worker mode: animations run in the worker (`ref.worker.animator`). */
  animator?: undefined;
  /** Not in worker mode: a worker canvas cannot be a tile of a shared buffer. */
  paintInto?: undefined;
  inputElement?: undefined;
  /** Not in worker mode: the worker's canvas and the page's beside it paint with WebGL 2. */
  backend?: undefined;
  layers?: { scene?: WorkerSceneSlot | CustomLayerEntry | null };
}

export type SceneCanvasPaintedBy = PagePaintedScene | WorkerPaintedScene;
