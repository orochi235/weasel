/**
 * A path effect that hides its sources is edited through itself: the source it
 * lays as items (a text node) and its path are reached from the effect node.
 */
import { findNodeShape, nodeShapesOf } from 'canvas/NodeShape';
import { pathEffectOf } from 'core/scene/pathEffects/derive';
import { sourcesOf } from 'core/scene/dependents';
import type { NodeId, Scene } from 'core/scene/types';

/** Which of a path effect's sources an edit goes to. */
export type EffectSourceRole = 'items' | 'path';

/**
 * For a path-effect node with `hideSources`, the source an edit of `role`
 * goes to: `'items'`, its first source when its painter lays it out as items
 * (`NodeShapeEntry.effectItems`, as text's does); `'path'`, the
 * path it lays along — the second source of an along kind, a tween's spine.
 * `null` otherwise. The one answer every edit route asks. It takes a source
 * hidden before the effect was made too: either way the effect is what shows it.
 */
export function effectSourceFor<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  id: NodeId,
  role: EffectSourceRole,
): NodeId | null {
  const node = scene.get(id);
  const effect = pathEffectOf(node);
  if (effect === null || effect.hideSources !== true) return null;
  const at = role === 'items' ? 0 : effect.kind === 'tween' ? 2 : 1;
  const source = sourcesOf(node)[at];
  const found = source === undefined ? undefined : scene.get(source);
  if (found === undefined) return null;
  return role === 'items' && !findNodeShape(found, nodeShapesOf(scene))?.effectItems ? null : source!;
}

/**
 * The path effects that `effectSourceFor` sends a `role` edit of `source` to:
 * each effect hiding `source` that shows it, in render order. What a mode
 * scoped to a hidden source lights, since the effect is what draws it.
 */
export function effectsShowing<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get' | 'renderOrderNodes'>,
  source: NodeId,
  role: EffectSourceRole,
): NodeId[] {
  const out: NodeId[] = [];
  for (const node of scene.renderOrderNodes()) {
    if (pathEffectOf(node) !== null && effectSourceFor(scene, node.id, role) === source) out.push(node.id);
  }
  return out;
}
