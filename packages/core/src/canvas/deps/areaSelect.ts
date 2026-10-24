/**
 * `useAreaSelectDepSource` — wires the `areaSelect` dep consumed by
 * `areaSelectAction`. The dep exposes:
 *   - `hitTestArea(bounds)` — silhouette-aware scan over `scene.renderOrderNodes()`
 *     (rect poses by AABB; polygon poses by the kernel polygon-overlap test).
 *   - `getSelection` / `setSelection` — passthrough to the kit selection api.
 *
 * Built once per render and stabilised by `useDepSource` (which reads via a
 * ref internally), so callers can pass fresh selection/scene refs without
 * triggering re-registration.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { AreaSelectDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { hitTestArea as hitTestAreaShared, regionPickOptions } from './hitTestArea';

export function useAreaSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  descriptor?: PoseDescriptor<unknown>,
  /** The painted alpha the surface's layers apply, which every view shares. */
  alphaOf?: (id: string) => number,
  /** Whether a node can be reached at all: the canvas's one answer, which picking reads too. */
  reachable?: (id: string) => boolean,
): void {
  const sceneRef = useLatest(scene);
  const selectionRef = useLatest(selection);
  const descriptorRef = useLatest(descriptor);
  const alphaOfRef = useLatest(alphaOf);
  const reachableRef = useLatest(reachable);

  useDepSource('areaSelect', (): AreaSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const d = descriptorRef.current;
    const a = alphaOfRef.current;
    const r = reachableRef.current;
    const keep = (ids: NodeId[]): NodeId[] => (r ? ids.filter((id) => r(id)) : ids);
    return {
      hitTestArea: (bounds, view) =>
        keep(hitTestAreaShared(sc, bounds, regionPickOptions(view, a), d)),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids),
    };
  });
}
