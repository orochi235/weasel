/**
 * The page's half of the scene copy a render worker keeps: what changed in a scene since the
 * last delta, in the scene's saved form, so function fields cross as registry keys.
 */
import type { Scene, SerializedNode } from '../../core/scene/types';
import type { SceneDelta, WireNode } from './protocol';

/** Reports a scene's changes, one delta per call, against what it reported last. */
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

const sameNode = (a: WireNode, b: WireNode): boolean => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if ((a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return false;
  }
  return true;
};

const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

export function createSceneDiff(): SceneDiff {
  let sent: Sent | null = null;
  return {
    forget() { sent = null; },
    next(scene) {
      const json = scene.toJSON();
      const nodes = new Map<string, WireNode>();
      const order: string[] = [];
      for (const n of json.nodes as readonly SerializedNode<unknown, string, unknown>[]) {
        nodes.set(n.id, n);
        order.push(n.id);
      }
      const frame = JSON.stringify([json.systemLayers, json.doc ?? null]);
      const was = sent;
      sent = { nodes, order, frame };
      if (!was || was.frame !== frame) return { reset: json };

      const changed: WireNode[] = [];
      for (const n of nodes.values()) {
        const before = was.nodes.get(n.id);
        if (!before || !sameNode(before, n)) changed.push(n);
      }
      const removed: string[] = [];
      for (const id of was.nodes.keys()) if (!nodes.has(id)) removed.push(id);
      const moved = !sameOrder(was.order, order);
      if (changed.length === 0 && removed.length === 0 && !moved) return null;
      return {
        ...(changed.length > 0 ? { nodes: changed } : {}),
        ...(removed.length > 0 ? { removed } : {}),
        ...(moved ? { order } : {}),
      };
    },
  };
}
