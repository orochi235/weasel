/**
 * `useNodeAtPointDepSource` — wires the `nodeAtPoint` dep consumed by
 * `moveAction` (reparent-on-drop) and any other action needing a
 * single-best pick. Delegates to `<SceneCanvas>`'s `pickEvery` (the
 * back-to-front pose-walking picker) so consumer-supplied geometry
 * overrides are honored automatically.
 *
 * The exclude set is consulted front-to-back: the dep returns the
 * topmost id that isn't in `exclude`, which lets callers ignore the
 * node(s) they're currently manipulating without separate plumbing.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { NodeAtPointDep } from 'interactions/actions/depSchema';
import { asNodeId } from 'core/scene/types';

export function useNodeAtPointDepSource(
  pickEvery: (worldX: number, worldY: number) => string[],
): void {
  const pickRef = useRef(pickEvery);
  pickRef.current = pickEvery;

  useDepSource('nodeAtPoint', (): NodeAtPointDep => {
    return (point, exclude) => {
      const ids = pickRef.current(point.x, point.y);
      if (ids.length === 0) return null;
      if (!exclude) {
        // `pickEvery` returns back-to-front; topmost is the last entry.
        return asNodeId(ids[ids.length - 1]);
      }
      const ex = exclude instanceof Set ? exclude : new Set(exclude);
      for (let i = ids.length - 1; i >= 0; i--) {
        if (!ex.has(asNodeId(ids[i]))) return asNodeId(ids[i]);
      }
      return null;
    };
  });
}
