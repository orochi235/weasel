/**
 * The page's half of the scene copy a render worker keeps: what changed in a scene since the
 * last delta, in the scene's saved form, so function fields cross as registry keys.
 */
import type { Scene, SerializedNode } from '../../core/scene/types';
import { sharedJSON, sharedNodeJSON } from '../../core/scene/owned';
import { treePreorder } from '../../core/scene/treeOrder';
import { scenePickIds } from '../scenePickIds';
import type { SceneDelta, WireNode } from './protocol';
import { sameList } from '@weasel-js/registry';

/** Reports a scene's changes, one delta per call, against what it reported last: from the scene's
 *  touched-ids feed, reading only the nodes it names, and from the whole scene when the feed cannot say. */
export interface SceneDiff {
  /** The changes since the last call, or `null` when there are none. The first call, and the
   *  first after {@link SceneDiff.forget}, is a reset. */
  next(scene: Scene<unknown, string, unknown>): SceneDelta | null;
  /** Report the whole scene next time. */
  forget(): void;
}

interface Sent {
  nodes: Map<string, WireNode>;
  order: string[];
  /** The layer stack and document values, which a change to resets the copy. */
  frame: string;
}

type AnyScene = Scene<unknown, string, unknown>;

const sameNode = (a: WireNode, b: WireNode): boolean => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if (!Object.hasOwn(b, k) || (a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return false;
  }
  return true;
};

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  sameList(a, b);

function delta(scene: AnyScene, changed: WireNode[], added: string[], removed: string[], order: string[] | null): SceneDelta {
  const pickIds = scenePickIds(scene);
  return {
    ...(changed.length > 0 ? { nodes: changed } : {}),
    ...(added.length > 0 ? { pickIds: added.map((id): [string, number] => [id, pickIds.pickIdOf(id)]) } : {}),
    ...(removed.length > 0 ? { removed } : {}),
    ...(order ? { order } : {}),
  };
}

export function createSceneDiff(): SceneDiff {
  let sent: Sent | null = null;
  /** The scene's change token as of `sent`. */
  let token: number | null = null;

  /** From the whole scene: a reset when nothing was sent or its frame moved, else every node compared. */
  function whole(scene: AnyScene): SceneDelta | null {
    token = scene.changesSince().token;
    const json = sharedJSON(scene);
    const nodes = new Map<string, WireNode>();
    const order: string[] = [];
    for (const n of json.nodes as readonly SerializedNode<unknown, string, unknown>[]) {
      nodes.set(n.id, n);
      order.push(n.id);
    }
    const frame = JSON.stringify([json.systemLayers, json.doc ?? null]);
    const was = sent;
    sent = { nodes, order, frame };
    if (!was || was.frame !== frame) {
      const pickIds = scenePickIds(scene);
      return { reset: json, pickIds: order.map((id) => [id, pickIds.pickIdOf(id)]) };
    }
    const changed: WireNode[] = [];
    for (const n of nodes.values()) {
      const before = was.nodes.get(n.id);
      if (!before || !sameNode(before, n)) changed.push(n);
    }
    const removed: string[] = [];
    for (const id of was.nodes.keys()) if (!nodes.has(id)) removed.push(id);
    const moved = !sameOrder(was.order, order);
    if (changed.length === 0 && removed.length === 0 && !moved) return null;
    const added = changed.filter((n) => !was.nodes.has(n.id)).map((n) => n.id);
    return delta(scene, changed, added, removed, moved ? order : null);
  }

  /** From the nodes the feed names since the last call; `undefined` when one cannot be read alone. */
  function touched(scene: AnyScene, held: Sent, ids: ReadonlySet<string>, structural: boolean): SceneDelta | null | undefined {
    const changed: WireNode[] = [];
    const added: string[] = [];
    const removed: string[] = [];
    for (const id of ids) {
      const n = sharedNodeJSON(scene, id) as WireNode | null | undefined;
      if (n === null) return undefined;
      const before = held.nodes.get(id);
      if (n === undefined) {
        if (before !== undefined) {
          held.nodes.delete(id);
          removed.push(id);
        }
        continue;
      }
      if (before !== undefined && sameNode(before, n)) continue;
      held.nodes.set(id, n);
      changed.push(n);
      if (before === undefined) added.push(id);
    }
    let order: string[] | null = null;
    if (structural) {
      const now = treePreorder(scene.roots, scene.nodes).map((n) => n.id as string);
      if (!sameOrder(held.order, now)) order = held.order = now;
    }
    if (changed.length === 0 && removed.length === 0 && order === null) return null;
    return delta(scene, changed, added, removed, order);
  }

  return {
    forget() {
      sent = null;
      token = null;
    },
    next(scene) {
      if (sent === null || token === null) return whole(scene);
      const since = scene.changesSince(token);
      if (since.ids === 'unknown') return whole(scene);
      token = since.token;
      const out = touched(scene, sent, since.ids, since.structural);
      return out === undefined ? whole(scene) : out;
    },
  };
}
