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

/**
 * The sources a removal of `ids` takes with it: those that a path effect with
 * `hideSources` in the removal hid, and that nothing staying still derives
 * from. A source another effect still reads stays, and so does one shown
 * again since or named in `keep`. Transitive, so an effect's hidden effect
 * takes its own too.
 */
export function hiddenSourcesTakenWith<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get' | 'removalClosure'>,
  ids: readonly NodeId[],
  keep: ReadonlySet<NodeId> = new Set(),
): NodeId[] {
  const going = new Set<NodeId>(scene.removalClosure(ids));
  const taken: NodeId[] = [];
  const within = (node: NodeId, root: NodeId): boolean => {
    for (let at: NodeId | null | undefined = node; at != null; at = scene.get(at)?.parent) if (at === root) return true;
    return false;
  };
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...going]) {
      const node = scene.get(id);
      if (pathEffectOf(node)?.hideSources !== true || !Array.isArray(node?.dependsOn)) continue;
      for (const source of node.dependsOn as readonly NodeId[]) {
        if (going.has(source) || keep.has(source) || scene.get(source)?.hidden !== true) continue;
        const closure = scene.removalClosure([source]);
        if (!closure.every((n) => going.has(n) || within(n, source))) continue;
        for (const n of closure) going.add(n);
        taken.push(source);
        grew = true;
      }
    }
  }
  return taken;
}
