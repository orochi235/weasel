/**
 * The scene's `hidden` flag on a path effect's sources: an effect with
 * `hideSources` hides them while it shows them, and a source two such
 * effects read stays hidden until neither does.
 */
import { createSetHiddenOp, type NodeId, type Op, pathEffectOf, type Scene, type SceneNode as Node } from '@weasel-js/core';

type AnyScene = Scene<unknown, string, unknown>;

/** A node's sources, in order; empty for a node that reads none. */
export const sourcesOf = (node: Node<unknown, string, unknown>): readonly NodeId[] =>
  (Array.isArray(node.dependsOn) ? node.dependsOn : []);

/** Whether an effect with `hideSources` other than those `leaving` reads `source`. */
export function hiddenByOthers(scene: AnyScene, source: NodeId, leaving: ReadonlySet<NodeId>): boolean {
  return scene.removalClosure([source]).some((id) => {
    if (leaving.has(id)) return false;
    const node = scene.get(id);
    return node !== undefined && pathEffectOf(node)?.hideSources === true && sourcesOf(node).includes(source);
  });
}

/** The op setting `id`'s own `hidden` flag to `to`, or none where it has it already. */
export function hiddenOps(scene: AnyScene, id: NodeId, to: boolean, label: string): Op[] {
  const from = scene.get(id)?.hidden === true;
  return from === to ? [] : [createSetHiddenOp({ id, from, to, label })];
}
