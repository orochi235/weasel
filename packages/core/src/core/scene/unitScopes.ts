import { magnificationOf, scopesOf, type UnitScope } from '@weasel-js/quantity';
import { deepEqual } from '@weasel-js/registry';
import type { NodeId } from './types';

/** What reading scopes needs of a scene. A `Scene` satisfies it. */
export interface ScopedScene {
  get(id: NodeId): { kind: string; parent: NodeId | null; units?: UnitScope } | undefined;
}

/**
 * The unit scopes enclosing node `id`, outermost first, under the scene's own
 * `root`: what `resolveScoped` and `formatScoped` take for a value that
 * positions or sizes it. A container's own scope covers its children, so it
 * is counted only under `inclusive`, for a value written inside it.
 */
export function sceneUnitScopes(
  scene: ScopedScene,
  id: NodeId,
  root: UnitScope,
  opts: { inclusive?: boolean } = {},
): UnitScope[] {
  return scopesOf(id, root, {
    parentOf: (at) => scene.get(at)?.parent,
    scopeOf: (at) => scene.get(at)?.units,
    ...(opts.inclusive ? { inclusive: true } : {}),
  });
}

/**
 * The unit scopes every node of `ids` sits in, outermost first: the run of
 * their chains that agree, where two containers declaring equal scopes
 * agree. What a reader showing or snapping several nodes as one reads them
 * in; the root alone for no nodes.
 */
export function sceneSharedUnitScopes(scene: ScopedScene, ids: readonly NodeId[], root: UnitScope): UnitScope[] {
  if (ids.length === 0) return [root];
  let shared = sceneUnitScopes(scene, ids[0]!, root);
  for (const id of ids.slice(1)) {
    const chain = sceneUnitScopes(scene, id, root);
    let n = 0;
    while (n < shared.length && n < chain.length && deepEqual(shared[n], chain[n])) n++;
    shared = shared.slice(0, n);
  }
  return shared;
}

const NO_ROOT: UnitScope = { system: { base: '', units: {} } };

/** The scopes the scene's own nodes declare around `id`, outermost first, with
 *  no root: empty where no container above it declares one. */
export function sceneDeclaredScopes(scene: ScopedScene, id: NodeId, opts: { inclusive?: boolean } = {}): UnitScope[] {
  return sceneUnitScopes(scene, id, NO_ROOT, opts).slice(1);
}

/**
 * How large the frame `ids` share is drawn in the world: every `drawnAt` their
 * shared scope chain declares, multiplied. A length measured in world between
 * them, divided by it, is the length they were modeled at.
 */
export function sceneMagnification(scene: ScopedScene, ids: readonly NodeId[]): number {
  return magnificationOf(sceneSharedUnitScopes(scene, ids, NO_ROOT));
}
