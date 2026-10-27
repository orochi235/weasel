/**
 * Entering a container, wired the way `<SceneCanvas>` wires it: an entered-group
 * dep, an `insertInto` dep naming the entered group, picks that stop at its
 * subtree, and core's group-entry contribution reading them. A double-click on a
 * solid enters the container a click there would select; Escape, or a press
 * outside its box, leaves it.
 */

import { useEffect, useMemo } from 'react';
import {
  createEnteredGroupScope,
  useDepSource,
  useEnteredGroup,
  useGroupEntryContribution,
  type EnteredGroupApi,
  type NodeId,
  type Tool,
} from '@weasel-js/core';
import { screenBoxOf, type ScreenBox, type Viewport3d, type World3d } from '@weasel-js/kernel3d';
import type { SolidData, SolidLayer } from './scene3d';

type SolidWorld = World3d<SolidData, SolidLayer>;
type Pick = (point: { x: number; y: number }, exclude?: Iterable<NodeId>) => NodeId | null;

export interface GroupEntry3d {
  entered: EnteredGroupApi;
  /** `nodeAtPoint`, blind to everything outside the entered group. */
  pick: Pick;
  /** Whether a press can land on `id` while the current group is entered. */
  reachable: (id: NodeId) => boolean;
  /** The client-space box `id` covers: a container's spans its solids. */
  boxOf: (id: NodeId) => ScreenBox | null;
  /** The `group.entry` contribution, for `entriesById`. */
  contribution: Tool;
}

export function useGroupEntry3d(
  world: SolidWorld, viewport: () => Viewport3d, nodeAtPoint: Pick, repaint: () => void,
): GroupEntry3d {
  const { scene } = world;
  const entered = useEnteredGroup(scene);
  useDepSource('enteredGroup', () => entered);
  // What is drawn while a container is entered lands in it, unless a source
  // registered under this one names another container.
  useDepSource('insertInto', (below) => ({ get: () => below()?.get() ?? entered.get() }));
  useEffect(() => entered.subscribe(repaint), [entered, repaint]);

  const scoped = useMemo(() => {
    const scope = createEnteredGroupScope({ entered, scene });
    const reachable = (id: NodeId): boolean => scope.isPointerInteractive(id);
    const pick: Pick = (point, exclude) => {
      if (entered.get() === null) return nodeAtPoint(point, exclude);
      const out = new Set<NodeId>(exclude);
      for (const node of scene.renderOrderNodes()) if (!reachable(node.id)) out.add(node.id);
      return nodeAtPoint(point, out);
    };
    const boxOf = (id: NodeId): ScreenBox | null => {
      const node = scene.get(id);
      if (!node) return null;
      if (node.kind !== 'group') return screenBoxOf(world, id, viewport());
      let box: ScreenBox | null = null;
      for (const child of scene.childrenOf(id)) box = union(box, boxOf(child));
      return box;
    };
    return { reachable, pick, boxOf };
  }, [entered, scene, world, viewport, nodeAtPoint]);

  const contribution = useGroupEntryContribution({
    pickHit: (point) => scoped.pick(point),
    tree: {
      getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
      getNode: (id) => scene.get(id as NodeId),
    },
    boxOf: (id) => scoped.boxOf(id as NodeId),
  }) as Tool;

  return useMemo(() => ({ entered, ...scoped, contribution }), [entered, scoped, contribution]);
}

function union(a: ScreenBox | null, b: ScreenBox | null): ScreenBox | null {
  if (!a || !b) return a ?? b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x, y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
