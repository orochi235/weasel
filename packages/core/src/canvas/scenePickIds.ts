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

function createScenePickIds(): ScenePickIds {
  const byNode = new Map<string, number>();
  const byPick: string[] = [''];
  return {
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

const BY_SCENE = new WeakMap<object, ScenePickIds>();

/**
 * The pick ids of `scene`'s nodes. Numbers are given as nodes are first
 * painted and never reused while the scene lives, so one learned from an id
 * frame stays good; they are per scene, so two scenes drawn into one frame
 * can give the same number to different nodes.
 */
export function scenePickIds(scene: object): ScenePickIds {
  let ids = BY_SCENE.get(scene);
  if (!ids) BY_SCENE.set(scene, (ids = createScenePickIds()));
  return ids;
}
