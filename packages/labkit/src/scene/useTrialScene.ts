import { type Scene, type SerializedScene, useLatest } from '@weasel-js/core';
import { useEffect, useRef, useState } from 'react';
import type { RenderContext } from '../instrument/types';

/** The state of an instrument whose subject is a weasel scene: the scene as
 *  `toJSON` wrote it, or `null` before anyone has edited it. */
export interface SceneTrialState<TData = unknown, TLayer extends string = string, TPose = unknown> {
  scene: SerializedScene<TData, TLayer, TPose> | null;
}

/**
 * The live scene of the trial around the caller, kept in step with the
 * trial's `state.scene` so persistence, Clone, Reset and snapshots carry it.
 *
 * `create` builds the scene a fresh trial opens on — its layers, registries and
 * initial nodes — and is called again for its contents whenever `state.scene`
 * goes back to `null`, as it does on Reset. A stored scene loads into a
 * `create`d one, so options the JSON cannot carry still apply. Every edit the
 * scene's history records is written back to the state; edits made elsewhere
 * load into the same `Scene`, so a canvas holding it keeps its reference.
 */
export function useTrialScene<
  TData,
  TLayer extends string,
  TPose,
  TS extends SceneTrialState<TData, TLayer, TPose>,
>(
  ctx: Pick<RenderContext<TS, unknown>, 'state' | 'setState'>,
  create: () => Scene<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose> {
  const stored = ctx.state.scene;
  const [scene] = useState(() => {
    const fresh = create();
    if (stored) fresh.loadState(stored);
    return fresh;
  });
  // The JSON this hook last saw in `state.scene`, written or loaded. Anything
  // else arriving there came from outside.
  const known = useRef(stored);
  const latest = useLatest({ setState: ctx.setState, create });

  useEffect(
    () =>
      scene.history.subscribe(() => {
        const json = scene.toJSON();
        known.current = json;
        latest.current.setState((prev) => ({ ...prev, scene: json }));
      }),
    [scene, latest],
  );

  useEffect(() => {
    if (stored === known.current) return;
    known.current = stored;
    scene.loadState(stored ?? latest.current.create().toJSON());
  }, [scene, stored, latest]);

  return scene;
}
