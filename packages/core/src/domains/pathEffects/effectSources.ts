/**
 * A path effect that hides its sources is edited through itself: its text and
 * its path are reached from the effect node.
 */
import { isTextData } from '@weasel-js/text';
import { pathEffectOf } from 'core/scene/pathEffects/derive';
import { sourcesOf } from 'core/scene/dependents';
import type { NodeId, Scene } from 'core/scene/types';

/**
 * For a path-effect node with `hideSources`, the source an edit of `role`
 * goes to: `'text'`, its first source when that is a text node; `'path'`, the
 * path it lays along — the second source of an along kind, a blend's spine.
 * `null` otherwise. The one answer every edit route asks. It takes a source
 * hidden before the effect was made too: either way the effect is what shows it.
 */
export function effectSourceFor<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  id: NodeId,
  role: 'text' | 'path',
): NodeId | null {
  const node = scene.get(id);
  const effect = pathEffectOf(node);
  if (effect === null || effect.hideSources !== true) return null;
  const at = role === 'text' ? 0 : effect.kind === 'blend' ? 2 : 1;
  const source = sourcesOf(node)[at];
  const found = source === undefined ? undefined : scene.get(source);
  if (found === undefined) return null;
  return role === 'text' && !isTextData(found.data) ? null : source!;
}

/**
 * The path effects that `effectSourceFor` sends a `role` edit of `source` to:
 * each effect hiding `source` that shows it, in render order. What a mode
 * scoped to a hidden source lights, since the effect is what draws it.
 */
export function effectsShowing<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get' | 'renderOrderNodes'>,
  source: NodeId,
  role: 'text' | 'path',
): NodeId[] {
  const out: NodeId[] = [];
  for (const node of scene.renderOrderNodes()) {
    if (pathEffectOf(node) !== null && effectSourceFor(scene, node.id, role) === source) out.push(node.id);
  }
  return out;
}
