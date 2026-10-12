import { scopesOf, type UnitScope } from '@weasel-js/quantity';
import type { NodeId } from './types';

/** What reading scopes needs of a scene. A `Scene` satisfies it. */
interface ScopedScene {
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
