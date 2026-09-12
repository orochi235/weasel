/**
 * `useLassoSelectDepSource` — wires the `lassoSelect` dep consumed by
 * `lassoSelectAction`. Reuses the same silhouette-aware `hitTestArea` as
 * `areaSelect` for the `hitTestArea` fallback. `hitTestLasso` is intentionally
 * omitted — the action falls back to `hitTestArea` when the predicate is absent.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { LassoSelectDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { hitTestArea as hitTestAreaShared } from './hitTestArea';
import type { PoseComposition } from 'features/groups/composePose';

export function useLassoSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  descriptor?: PoseDescriptor<unknown>,
  poseComposition?: PoseComposition<unknown>,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;

  useDepSource('lassoSelect', (): LassoSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const d = descriptorRef.current;
    return {
      hitTestArea: (bounds) =>
        hitTestAreaShared(sc, bounds, poseComposition ? { poseComposition } : undefined, d),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids as NodeId[]),
    };
  });
}
