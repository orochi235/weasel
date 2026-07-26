/**
 * `useAreaSelectDepSource` — wires the `areaSelect` dep consumed by
 * `areaSelectAction`. The dep exposes:
 *   - `hitTestArea(bounds)` — silhouette-aware scan over `scene.renderOrder()`
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
import { hitTestArea as hitTestAreaShared } from './hitTestArea';

export function useAreaSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useDepSource('areaSelect', (): AreaSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    return {
      hitTestArea: (bounds) => hitTestAreaShared(sc, bounds),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids),
    };
  });
}
