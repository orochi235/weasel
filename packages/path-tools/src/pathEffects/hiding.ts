/**
 * The scene's `hidden` flag on a path effect's sources: an effect with
 * `hideSources` hides them while it shows them, and a source two such
 * effects hide stays hidden until neither does. One hidden before any effect
 * hid it stays hidden.
 */
import { createSetHiddenOp, type NodeId, type Op, type Scene, sourcesHiddenBy } from '@weasel-js/core';

type AnyScene = Scene<unknown, string, unknown>;

/** Whether an effect other than those `leaving` holds `source` hidden. */
export function hiddenByOthers(scene: AnyScene, source: NodeId, leaving: ReadonlySet<NodeId> = new Set()): boolean {
  return scene.removalClosure([source]).some((id) => !leaving.has(id) && sourcesHiddenBy(scene, id).includes(source));
}

/** Whether `source` is hidden by something other than an effect, apart from those `leaving`. */
export const hiddenOnItsOwn = (scene: AnyScene, source: NodeId, leaving?: ReadonlySet<NodeId>): boolean =>
  scene.get(source)?.hidden === true && !hiddenByOthers(scene, source, leaving);

/** The op setting `id`'s own `hidden` flag to `to`, or none where it has it already. */
export function hiddenOps(scene: AnyScene, id: NodeId, to: boolean, label: string): Op[] {
  const from = scene.get(id)?.hidden === true;
  return from === to ? [] : [createSetHiddenOp({ id, from, to, label })];
}
