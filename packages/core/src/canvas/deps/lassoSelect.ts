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

export function useLassoSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  descriptor?: PoseDescriptor<unknown>,
  /** The painted alpha the surface's layers apply, which every view shares. */
  alphaOf?: (id: string) => number,
  /** Whether a node can be reached at all: the canvas's one answer, which picking reads too. */
  reachable?: (id: string) => boolean,
  /** The node selecting a hit selects, as a click picks. */
  targetOf?: (id: string) => string,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const descriptorRef = useLatest(descriptor);
  const alphaOfRef = useLatest(alphaOf);
  const reachableRef = useLatest(reachable);
  const targetOfRef = useLatest(targetOf);

  useDepSource('lassoSelect', (): LassoSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const d = descriptorRef.current;
    const a = alphaOfRef.current;
    const r = reachableRef.current;
    const t = targetOfRef.current;
    const keep = (ids: NodeId[]): NodeId[] => (r ? ids.filter((id) => r(id)) : ids);
    return {
      hitTestLasso: (polygon, mode, view) =>
        keep(hitTestLassoPolygon(sc, polygon, mode, regionPickOptions(view, a), d)),
      hitTestArea: (bounds, view) =>
        keep(hitTestAreaShared(sc, bounds, regionPickOptions(view, a), d)),
      ...(t ? { targetOf: t } : {}),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids as NodeId[]),
    };
  });
}
