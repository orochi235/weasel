/**
 * Render-worker clients held by the canvas they paint. A canvas can be handed to a worker only
 * once, and a StrictMode remount runs cleanup and setup back to back on the same element, so a
 * release lets its client go a task later and a hold in between takes it back.
 */
import { startSceneRenderWorker, type SceneRenderInputs, type SceneRenderWorker } from './startSceneRenderWorker';

export type AnyRenderWorker = SceneRenderWorker<unknown, string, unknown>;

const LIVE = new WeakMap<HTMLCanvasElement, { client: AnyRenderWorker; release?: ReturnType<typeof setTimeout> }>();

/** The client painting `canvas`, started from `start` and `inputs` if none is. `release` lets it
 *  go: a task later, unless the canvas is held again first. */
export function holdRenderWorker(
  canvas: HTMLCanvasElement,
  start: () => Worker,
  inputs: SceneRenderInputs<unknown, string, unknown>,
): { client: AnyRenderWorker; release: () => void } {
  let entry = LIVE.get(canvas);
  if (entry?.release !== undefined) clearTimeout(entry.release);
  else if (!entry) {
    entry = { client: startSceneRenderWorker(start(), canvas, inputs) };
    LIVE.set(canvas, entry);
  }
  const held = entry;
  held.release = undefined;
  return {
    client: held.client,
    release() {
      held.release = setTimeout(() => {
        LIVE.delete(canvas);
        held.client.dispose();
      }, 0);
    },
  };
}
