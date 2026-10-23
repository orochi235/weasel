import type { Scene, NodeId } from 'core/scene/types';
import type { CanDropIntoDep } from 'interactions/actions/layoutDeps';
import { insertParent } from 'interactions/actions/insert/parent';
import { composesFrames, composeWorldPose } from 'core/scene/composeFrame';
import { definesFrame } from 'core/scene/effectivePose';

/** Where a new node lands: its parent, its layer, and how a world pose becomes its stored one. */
export interface InsertSite {
  parent: NodeId | null;
  layer: string;
  local: (world: unknown) => unknown;
}

/**
 * Where an insert lands: the container the `insertInto` dep names, on that container's
 * layer, with the pose made local to it when the scene composes frames —
 * or the top of the tree, on the first layer, when it names no container.
 */
export function insertSite(
  sc: Pick<Scene<unknown, string, unknown>, 'get' | 'layers' | 'composition'>,
  into: string | null | undefined,
  canDropInto?: CanDropIntoDep,
): InsertSite {
  const parentId = insertParent(sc, into, canDropInto);
  if (parentId === null) {
    return { parent: null, layer: (sc.layers[0]?.id ?? 'default') as string, local: (p) => p };
  }
  const parent = sc.get(parentId)!;
  const composition = sc.composition;
  if (composition === undefined || !composesFrames(composition)) {
    return { parent: parent.id, layer: parent.layer, local: (p) => p };
  }
  const frame = composeWorldPose({
    getPose: (id) => sc.get(id as NodeId)!.pose,
    getParent: (id) => sc.get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => definesFrame(sc.get(id as NodeId) ?? {}),
  }, parent.id, composition.compose);
  return { parent: parent.id, layer: parent.layer, local: (p) => composition.decompose(frame, p) };
}
