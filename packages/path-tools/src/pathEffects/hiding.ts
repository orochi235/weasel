/**
 * The scene's `hidden` flag on a path effect's sources: an effect with
 * `hideSources` hides them while it shows them, and a source two such
 * effects hide stays hidden until neither does. One hidden before any effect
 * hid it stays hidden.
 */
import {
  createSetDataOp, createSetHiddenOp, type NodeId, type Op, pathEffectOf, type PathEffect, type Scene, type SceneNode as Node,
  sourcesHiddenBy,
} from '@weasel-js/core';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

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

/** The ops showing `source` as `leaving` stop reading it: shown where one of
 *  `by` (all of `leaving`, unless named) hid it and no other effect still does. */
export function releasedOps(
  scene: AnyScene, source: NodeId, leaving: readonly AnyNode[], label: string, by: readonly AnyNode[] = leaving,
): Op[] {
  const held = by.some((effect) => sourcesHiddenBy(scene, effect.id).includes(source));
  return held && !hiddenByOthers(scene, source, new Set(leaving.map((e) => e.id))) ? hiddenOps(scene, source, false, label) : [];
}

/**
 * The ops for `effect` taking `source` as its source at position `at`, where
 * it hides its sources: `source` is hidden, or, where it is hidden already on
 * its own, recorded in `foundHidden` so letting it go leaves it hidden. Goes
 * after the retarget of `dependsOn`, which has dropped the old source's place.
 */
export function takenOps(scene: AnyScene, effect: AnyNode, at: number, source: NodeId, label: string): Op[] {
  const record = pathEffectOf(effect);
  if (record?.hideSources !== true) return [];
  if (!hiddenOnItsOwn(scene, source, new Set([effect.id]))) return hiddenOps(scene, source, true, label);
  const pathEffect: PathEffect = { ...record, foundHidden: [...(record.foundHidden ?? []).filter((i) => i !== at), at] };
  return [createSetDataOp({ id: effect.id, from: effect.data, to: { ...(effect.data as object), pathEffect }, label })];
}
