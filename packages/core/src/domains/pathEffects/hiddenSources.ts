/**
 * The sources a path effect with `hideSources` holds hidden, and the ones a
 * removal takes with it. Apart from `effectSources.ts`, which reads text, so
 * deleting a node loads no typography.
 */
import { pathEffectOf } from 'core/scene/pathEffects/derive';
import { sourcesOf } from 'core/scene/dependents';
import type { NodeId, Scene } from 'core/scene/types';

/**
 * The sources path-effect node `id` holds hidden: with `hideSources`, each of
 * its sources but those it found hidden. Empty for any other node.
 */
export function sourcesHiddenBy<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  id: NodeId,
): NodeId[] {
  const node = scene.get(id);
  const effect = pathEffectOf(node);
  if (effect?.hideSources !== true) return [];
  const found = effect.foundHidden ?? [];
  return sourcesOf(node).filter((_, at) => !found.includes(at));
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
      for (const source of sourcesHiddenBy(scene, id)) {
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
