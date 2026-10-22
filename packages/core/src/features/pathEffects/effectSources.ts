/**
 * A path effect that hides its sources is edited through itself: its text and
 * its path are reached from the effect node.
 */
import { isTextData } from '@weasel-js/text';
import { pathEffectOf } from 'core/scene/pathEffects/derive';
import type { NodeId, Scene } from 'core/scene/types';

/**
 * For a path-effect node with `hideSources`, the source an edit of `role`
 * goes to: `'text'`, its first source when that is a text node; `'path'`, the
 * path it lays along — the second source of an along kind, a blend's spine.
 * `null` otherwise. The one answer every edit route asks.
 */
export function effectSourceFor<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: NodeId,
  role: 'text' | 'path',
): NodeId | null {
  const node = scene.get(id);
  const effect = pathEffectOf(node);
  const sources = node?.dependsOn;
  if (effect === null || effect.hideSources !== true || !Array.isArray(sources)) return null;
  const at = role === 'text' ? 0 : effect.kind === 'blend' ? 2 : 1;
  const source = (sources as readonly NodeId[])[at];
  const found = source === undefined ? undefined : scene.get(source);
  if (found === undefined) return null;
  return role === 'text' && !isTextData(found.data) ? null : source!;
}
