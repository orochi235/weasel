/**
 * `useLassoSelectDepSource` — wires the `lassoSelect` dep consumed by
 * `lassoSelectAction`. Reuses the same AABB hit-test as `areaSelect` for the
 * `hitTestArea` fallback. `hitTestLasso` is intentionally omitted — the action
 * falls back to `hitTestArea` when the predicate is absent.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { LassoSelectDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { hitTestAABB } from './aabbHitTest';

export function useLassoSelectDepSource(
  scene: Scene<unknown, string, unknown>,
  selection: SelectionApi,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useDepSource('lassoSelect', (): LassoSelectDep => {
    const sc = sceneRef.current;
    const s = selectionRef.current;
    return {
      hitTestArea: (bounds) => hitTestAABB(sc, bounds),
      getSelection: () => s.current as NodeId[],
      setSelection: (ids) => s.set(ids as NodeId[]),
    };
  });
}
