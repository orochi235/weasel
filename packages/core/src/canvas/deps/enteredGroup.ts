/**
 * The entered group: the group a press resolves inside of. Session state beside
 * the selection, not scene data, so it is never saved and never undone.
 *
 * It remembers the entered group and the groups above it. `get()` answers the
 * innermost of those still in the scene, so deleting the group lands on its
 * parent, and an undo that brings it back lands on it again.
 */
import { useEffect, useMemo } from 'react';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import type { NodeId, Scene } from 'core/scene/types';

export interface EnteredGroupDep {
  get(): NodeId | null;
  enter(id: NodeId): void;
  /** Moves to the nearest group above the current one, or to none. */
  leave(): void;
  subscribe(fn: () => void): () => void;
}

type SceneReads = Pick<Scene<unknown, string, unknown>, 'get' | 'ancestorsOf' | 'subscribe'>;

export function createEnteredGroup(scene: SceneReads): EnteredGroupDep {
  let chain: NodeId[] = [];
  let announced: NodeId | null = null;
  const listeners = new Set<() => void>();

  const isGroup = (id: NodeId) => scene.get(id)?.kind === 'group';
  const get = (): NodeId | null => chain.find(isGroup) ?? null;
  const groupsFrom = (id: NodeId): NodeId[] => [id, ...scene.ancestorsOf(id)].filter(isGroup);

  const announce = () => {
    announced = get();
    for (const fn of [...listeners]) fn();
  };

  let stopScene: (() => void) | null = null;
  const watchScene = () => scene.subscribe(() => {
    if (get() !== announced) announce();
  });

  return {
    get,
    enter(id) {
      if (!isGroup(id)) return;
      chain = groupsFrom(id);
      announce();
    },
    leave() {
      const here = get();
      if (here === null) return;
      chain = groupsFrom(here).slice(1);
      announce();
    },
    subscribe(fn) {
      if (listeners.size === 0) {
        announced = get();
        stopScene = watchScene();
      }
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
        if (listeners.size === 0) { stopScene?.(); stopScene = null; }
      };
    },
  };
}

export function useEnteredGroupDepSource(scene: SceneReads): void {
  const dep = useMemo(() => createEnteredGroup(scene), [scene]);
  useDepSource('enteredGroup', () => dep);
  const registry = useDepRegistry();
  useEffect(() => dep.subscribe(() => registry.changed?.()), [dep, registry]);
}
