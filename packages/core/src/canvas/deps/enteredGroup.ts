/**
 * The entered group: the group a press resolves inside of. Session state beside
 * the selection, not scene data, so it is never saved and never undone.
 *
 * It remembers the entered group and the groups above it. `get()` answers the
 * innermost of those still in the scene, so deleting the group lands on its
 * parent, and an undo that brings it back lands on it again.
 */
import { useEffect, useMemo } from 'react';
import { createEmitter } from '@weasel-js/registry';
import { useDepRegistry, useDepSource } from '@weasel-js/routing/react';
import type { NodeId, Scene } from 'core/scene/types';

/** The group a press resolves inside of, held beside the selection; `<SceneCanvas enteredGroup>` takes one. */
export interface EnteredGroupApi {
  get(): NodeId | null;
  enter(id: NodeId): void;
  /** Moves to the nearest group above the current one, or to none. */
  leave(): void;
  /** Leaves every entered group at once. */
  leaveAll(): void;
  subscribe(fn: () => void): () => void;
}

/** Whether a node is entered as a group is: a group, or a node that consumes its children. */
export function isEnterable(node: { kind?: string; consumesChildren?: boolean } | undefined): boolean {
  return node?.kind === 'group' || node?.consumesChildren === true;
}

/** Whether `id` is reachable while `group` is entered: inside it, and not the group itself, and
 *  not consumed by a node inside it (`SceneNode.consumesChildren`). With nothing entered every node
 *  no node consumes is. Picking, region selects and select-all all ask this. */
export function reachableInGroup(
  scene: Pick<Scene<unknown, string, unknown>, 'ancestorsOf' | 'get'>,
  group: NodeId | null,
  id: string,
): boolean {
  for (const above of scene.ancestorsOf(id as NodeId)) {
    if (above === group) return true;
    if (scene.get(above)?.consumesChildren === true) return false;
  }
  return group === null;
}

type SceneReads = Pick<Scene<unknown, string, unknown>, 'get' | 'ancestorsOf' | 'subscribe'>;

/** An entered-group store over `scene`, with nothing entered. */
export function createEnteredGroup(scene: SceneReads): EnteredGroupApi {
  let chain: NodeId[] = [];
  let announced: NodeId | null = null;
  const listeners = createEmitter();

  const isGroup = (id: NodeId) => isEnterable(scene.get(id));
  const get = (): NodeId | null => chain.find(isGroup) ?? null;
  const groupsFrom = (id: NodeId): NodeId[] => [id, ...scene.ancestorsOf(id)].filter(isGroup);

  const announce = () => {
    announced = get();
    listeners.emit();
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
    leaveAll() {
      if (get() === null) return;
      chain = [];
      announce();
    },
    subscribe(fn) {
      if (listeners.size === 0) {
        announced = get();
        stopScene = watchScene();
      }
      const off = listeners.subscribe(fn);
      return () => {
        off();
        if (listeners.size === 0) { stopScene?.(); stopScene = null; }
      };
    },
  };
}

/** One entered-group store for the life of the scene. */
export function useEnteredGroup(scene: SceneReads): EnteredGroupApi {
  return useMemo(() => createEnteredGroup(scene), [scene]);
}

export function useEnteredGroupApiSource(dep: EnteredGroupApi): void {
  useDepSource('enteredGroup', () => dep);
  // What is drawn or pasted while a group is entered lands in it, unless a source
  // registered under this one, such as a symmetry group, names a container.
  useDepSource('insertInto', (below) => ({ get: () => below()?.get() ?? dep.get() }));
  const registry = useDepRegistry();
  useEffect(() => dep.subscribe(() => registry.changed?.()), [dep, registry]);
}
