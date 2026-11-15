/**
 * The `pickId` each scene node's paint carries, so a pixel of an id frame
 * (`WeaselRenderer.renderIds`) names the node that painted it.
 */
import { MAX_PICK_ID } from '@weasel-js/renderer';
import { asNodeId, type NodeId } from 'core/scene/types';
import { documentScene } from 'core/scene/editingSession';

/** One scene's node ids and the numbers its paint carries for them. */
export interface ScenePickIds {
  /** The number `id`'s paint carries, given on first ask and kept while the node is in the
   *  scene. Once every number has been given, a node removed since gives its number back. */
  idOf(id: string): number;
  /** The node whose paint carries `pickId`; `null` for 0, a number this scene never gave,
   *  or one whose node has left the scene. */
  nodeOf(pickId: number): NodeId | null;
}

interface OwnPickIds extends ScenePickIds {
  /** Give `id` the number `n`, as another realm's copy of the scene numbered it. */
  adopt(id: string, n: number): void;
}

/** Numbers are handed out in order; once they run out, the numbers of nodes `live` no longer
 *  holds go out again, lowest first. Not consumer surface: `max` is there for tests. */
export function createScenePickIds(live: (id: string) => boolean, max = MAX_PICK_ID): OwnPickIds {
  const byNode = new Map<string, number>();
  const byPick: string[] = [''];
  let free: number[] = [];
  let next = 0;
  const reclaim = (): void => {
    free = [];
    next = 0;
    for (let n = 1; n < byPick.length; n++) {
      const id = byPick[n];
      if (id && live(id)) continue;
      if (id) byNode.delete(id);
      byPick[n] = '';
      free.push(n);
    }
  };
  return {
    adopt(id, n) {
      const was = byNode.get(id);
      if (was === n) return;
      if (was !== undefined) byPick[was] = '';
      const held = byPick[n];
      if (held) byNode.delete(held);
      byNode.set(id, n);
      byPick[n] = id;
    },
    idOf(id) {
      let n = byNode.get(id);
      if (n !== undefined) return n;
      if (byPick.length <= max) {
        n = byPick.length;
        byPick.push(id);
      } else {
        if (next >= free.length) reclaim();
        if (next >= free.length) {
          throw new RangeError(`scenePickIds: a scene can name ${max} nodes in an id frame`);
        }
        n = free[next++]!;
        const held = byPick[n];
        if (held) byNode.delete(held);
        byPick[n] = id;
      }
      byNode.set(id, n);
      return n;
    },
    nodeOf(pickId) {
      const id = pickId > 0 ? byPick[pickId] : undefined;
      return id && live(id) ? asNodeId(id) : null;
    },
  };
}

const BY_SCENE = new WeakMap<object, OwnPickIds>();

function liveIn(scene: object): (id: string) => boolean {
  const get = (scene as { get?: (id: NodeId) => unknown }).get;
  return typeof get === 'function' ? (id) => get.call(scene, asNodeId(id)) !== undefined : () => true;
}

function pickIdsOf(scene: object): OwnPickIds {
  const key = documentScene(scene);
  let ids = BY_SCENE.get(key);
  if (!ids) BY_SCENE.set(key, (ids = createScenePickIds(liveIn(key))));
  return ids;
}

/**
 * The pick ids of `scene`'s nodes. Numbers are given as nodes are first painted. A removed
 * node's number goes to another node only once the scene has given every number there is,
 * so one learned from an id frame stays good until then. Numbers are per scene, so two scenes
 * drawn into one frame can give the same number to different nodes; an editing session and a
 * `documentOf` reading number as their scene does.
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
