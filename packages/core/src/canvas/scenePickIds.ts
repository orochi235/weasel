/**
 * The `pickId` each scene node's paint carries, so a pixel of an id frame
 * (`WeaselRenderer.renderIds`) names the node that painted it.
 */
import { MAX_PICK_ID } from '@weasel-js/renderer';
import { asNodeId, type NodeId } from 'core/scene/types';

/** One scene's node ids and the numbers its paint carries for them. */
export interface ScenePickIds {
  /** The number `id`'s paint carries, given on first ask and kept for the
   *  scene's life. */
  idOf(id: string): number;
  /** The node whose paint carries `pickId`; `null` for 0 or a number this
   *  scene never gave. */
  nodeOf(pickId: number): NodeId | null;
}

interface OwnPickIds extends ScenePickIds {
  /** Give `id` the number `n`, as another realm's copy of the scene numbered it. */
  adopt(id: string, n: number): void;
}

function createScenePickIds(): OwnPickIds {
  const byNode = new Map<string, number>();
  const byPick: string[] = [''];
  return {
    adopt(id, n) {
      const was = byNode.get(id);
      if (was === n) return;
      if (was !== undefined) delete byPick[was];
      const held = byPick[n];
      if (held !== undefined && held !== '') byNode.delete(held);
      byNode.set(id, n);
      byPick[n] = id;
    },
    idOf(id) {
      let n = byNode.get(id);
      if (n === undefined) {
        n = byPick.length;
        if (n > MAX_PICK_ID) {
          throw new RangeError(`scenePickIds: a scene can name ${MAX_PICK_ID} nodes in an id frame`);
        }
        byNode.set(id, n);
        byPick.push(id);
      }
      return n;
    },
    nodeOf(pickId) {
      const id = pickId > 0 ? byPick[pickId] : undefined;
      return id === undefined ? null : asNodeId(id);
    },
  };
}

const BY_SCENE = new WeakMap<object, OwnPickIds>();

function pickIdsOf(scene: object): OwnPickIds {
  let ids = BY_SCENE.get(scene);
  if (!ids) BY_SCENE.set(scene, (ids = createScenePickIds()));
  return ids;
}

/**
 * The pick ids of `scene`'s nodes. Numbers are given as nodes are first
 * painted and never reused while the scene lives, so one learned from an id
 * frame stays good; they are per scene, so two scenes drawn into one frame
 * can give the same number to different nodes.
 */
export function scenePickIds(scene: object): ScenePickIds {
  return pickIdsOf(scene);
}

/**
 * Number `scene`'s nodes as `pairs` say, `[nodeId, pickId]` each, so a copy of a scene in
 * another realm (a render worker's) paints the numbers the original's `scenePickIds` gave.
 * Not consumer surface.
 */
export function adoptScenePickIds(scene: object, pairs: Iterable<readonly [string, number]>): void {
  const ids = pickIdsOf(scene);
  for (const [id, n] of pairs) ids.adopt(id, n);
}
