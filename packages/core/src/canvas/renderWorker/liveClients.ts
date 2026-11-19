/**
 * Render-worker clients held by the canvas they paint. A canvas can be handed to a worker only
 * once, and a StrictMode remount runs cleanup and setup back to back on the same element, so a
 * release lets its client go a task later and a hold in between takes it back. A canvas whose
 * client went (a hidden `<Activity>` or a re-suspended boundary keeps the element) is spent: a
 * hold on it answers `null`, and its owner mounts a new canvas.
 */
import { startSceneRenderWorker, type SceneRenderInputs, type SceneRenderWorker } from './startSceneRenderWorker';
import type { RenderWorkerOptions } from './workerHealth';

export type AnyRenderWorker = SceneRenderWorker<unknown, string, unknown>;

const LIVE = new WeakMap<HTMLCanvasElement, { client: AnyRenderWorker; release?: ReturnType<typeof setTimeout> }>();
/** Canvases handed to a worker whose client has since been let go. */
const SPENT = new WeakSet<HTMLCanvasElement>();

/** The client painting `canvas`, started from `start` and `inputs` if none is. `release` lets it
 *  go: a task later, unless the canvas is held again first. A start that throws holds nothing
 *  and rethrows; the worker it made, if any, is terminated. `null` for a spent canvas, which no
 *  worker can take again. */
export function holdRenderWorker(
  canvas: HTMLCanvasElement,
  start: () => Worker,
  inputs: SceneRenderInputs<unknown, string, unknown>,
  options?: RenderWorkerOptions,
): { client: AnyRenderWorker; release: () => void } | null {
  if (SPENT.has(canvas)) return null;
  let entry = LIVE.get(canvas);
  if (entry?.release !== undefined) clearTimeout(entry.release);
  else if (!entry) {
    entry = { client: startSceneRenderWorker(start(), canvas, inputs, options) };
    LIVE.set(canvas, entry);
  }
  const held = entry;
  held.release = undefined;
  return {
    client: held.client,
    release() {
      held.release = setTimeout(() => {
        LIVE.delete(canvas);
        SPENT.add(canvas);
        held.client.dispose();
      }, 0);
    },
  };
}
