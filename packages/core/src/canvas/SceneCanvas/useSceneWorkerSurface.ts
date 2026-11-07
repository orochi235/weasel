/**
 * `<SceneCanvas worker>`'s half of the worker stack: which layers the worker paints, and what
 * its frames read of the scene canvas — the scene, `alphaFor`, the scene slot's `cull`, the clock.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Scene } from 'core/scene/types';
import { isCustomEntry } from '../layerSlots';
import { isSceneLayer } from '../renderWorker/layerRuns';
import type { CanvasWorkerSurface } from '../renderWorker/workerStack';
import type { FollowedClock } from '../renderWorker/startSceneRenderWorker';

/** What a worker frame reads of the scene canvas now. A node an in-flight gesture is ghosting
 *  paints at alpha 0, since the page paints its ghost. */
export function workerInputs(args: {
  scene: Scene<unknown, string, unknown>;
  alphaFor: ((id: string) => number) | undefined;
  sceneSlot: unknown;
  clock: FollowedClock | undefined;
  previewIds: () => Iterable<string> | null;
}): ReturnType<CanvasWorkerSurface['inputs']> {
  const { scene, alphaFor, sceneSlot, clock, previewIds } = args;
  const hidden = new Set(previewIds() ?? []);
  const cull = (sceneSlot as { cull?: boolean } | undefined)?.cull;
  return {
    scene,
    alphaFor: hidden.size > 0 || alphaFor ? (id: string) => (hidden.has(id) ? 0 : (alphaFor?.(id) ?? 1)) : undefined,
    ...(cull !== undefined ? { cull } : {}),
    clock,
  };
}

/** The props of `<SceneCanvas>` this reads. */
interface WorkerSurfaceProps {
  worker?: (() => Worker) | undefined;
  clock?: FollowedClock | undefined;
  alphaFor?: ((id: string) => number) | undefined;
  layers?: { scene?: unknown } | undefined;
}

/** @param previewIds Ids an in-flight gesture is ghosting. */
export function useSceneWorkerSurface(
  props: WorkerSurfaceProps, scene: Scene<unknown, string, unknown>, previewIds: () => Iterable<string> | null,
): CanvasWorkerSurface | undefined {
  const args = {
    worker: props.worker, clock: props.clock, alphaFor: props.alphaFor, sceneSlot: props.layers?.scene, scene, previewIds,
  };
  const latest = useLatest(args);
  const on = args.worker !== undefined;
  // A pre-built scene layer is the page's, and an empty slot has nothing to paint.
  const pageBuilt = args.sceneSlot === null || isCustomEntry(args.sceneSlot);
  return useMemo<CanvasWorkerSurface | undefined>(() => (on && !pageBuilt ? {
    start: () => latest.current.worker!(),
    paints: isSceneLayer,
    inputs: () => workerInputs(latest.current),
  } : undefined), [on, pageBuilt, latest]);
}
