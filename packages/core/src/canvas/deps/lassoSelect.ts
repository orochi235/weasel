/**
 * `useLassoSelectDepSource` — wires the `lassoSelect` dep consumed by
 * `lassoSelectAction`: `hitTestLasso` tests the lasso polygon itself, and
 * `hitTestArea` is the same silhouette-aware rect test `areaSelect` uses.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { LassoSelectDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { hitTestArea as hitTestAreaShared, hitTestLassoPolygon, regionPickOptions } from './hitTestArea';
import type { PoseComposition } from 'features/groups/composePose';

export function useLassoSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  descriptor?: PoseDescriptor<unknown>,
  poseComposition?: PoseComposition<unknown>,
  /** The painted alpha the surface's layers apply, which every view shares. */
  alphaOf?: (id: string) => number,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const descriptorRef = useLatest(descriptor);
  const alphaOfRef = useLatest(alphaOf);

  useDepSource('lassoSelect', (): LassoSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const d = descriptorRef.current;
    const a = alphaOfRef.current;
    return {
      hitTestLasso: (polygon, mode, view) =>
        hitTestLassoPolygon(sc, polygon, mode, regionPickOptions(view, a, poseComposition), d),
      hitTestArea: (bounds, view) =>
        hitTestAreaShared(sc, bounds, regionPickOptions(view, a, poseComposition), d),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids as NodeId[]),
    };
  });
}
