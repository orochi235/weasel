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
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { AreaSelectDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { hitTestArea as hitTestAreaShared, regionPickOptions } from './hitTestArea';
import type { PoseComposition } from 'features/groups/composePose';

export function useAreaSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
  descriptor?: PoseDescriptor<unknown>,
  poseComposition?: PoseComposition<unknown>,
  /** The painted alpha the surface's layers apply, which every view shares. */
  alphaOf?: (id: string) => number,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;
  const alphaOfRef = useRef(alphaOf);
  alphaOfRef.current = alphaOf;

  useDepSource('areaSelect', (): AreaSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    const d = descriptorRef.current;
    const a = alphaOfRef.current;
    return {
      hitTestArea: (bounds, view) =>
        hitTestAreaShared(sc, bounds, regionPickOptions(view, a, poseComposition), d),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids),
    };
  });
}
