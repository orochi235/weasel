import { diagramEdgeOf } from '../edgeTrait';
import { diagramLabelOf } from '../labelTrait';
import { dataKeyReader } from '../trait';
import type { DropVerdict } from '@weasel-js/core';
import { bodyBox, diagramContainerOf, type ContainerRole } from './trait';

type SceneLike = { get(id: never): { id: string; kind: 'mark' | 'group'; data: unknown; parent?: string | null } | undefined };

/** Whether the nodes `ids` may move into the container or lane `container`. */
export type CanReparent = (ids: readonly string[], container: string) => DropVerdict;

/**
 * The `canDropInto` dep for a diagram scene. A container or a lane takes
 * shapes and other containers, a pool takes only lanes, and a lane goes
 * nowhere but a pool. A stencil body, an edge, or a label takes nothing, and
 * edges and labels are never dropped in: they stay where they are, drawn from
 * what they are attached to. Any other container — a plain group — takes
 * anything but a lane. `canReparent` is asked about a move the rules allow
 * into a container the nodes are not already in, and has the last word.
 */
export function diagramCanDropInto(
  scene: SceneLike,
  canReparent?: CanReparent,
): (parent: string, ids: readonly string[]) => DropVerdict {
  const nodeOf = (id: string) => scene.get(id as never);
  const roleOf = (id: string) => {
    const node = nodeOf(id);
    return node === undefined ? null : diagramContainerOf(node)?.role ?? null;
  };
  const attached = (id: string) => {
    const node = nodeOf(id);
    return node !== undefined && (diagramEdgeOf(node) !== null || diagramLabelOf(node) !== null);
  };
  const allowed = (parent: string, ids: readonly string[]): boolean => {
    const node = nodeOf(parent);
    if (node === undefined || ids.some(attached)) return false;
    const role = roleOf(parent);
    if (role === 'pool') return ids.every((id) => roleOf(id) === 'lane');
    if (ids.some((id) => roleOf(id) === 'lane')) return false;
    if (role !== null) return ids.every((id) => roleOf(id) !== 'pool');
    return !attached(parent) && dataKeyReader(node) === null;
  };
  return (parent, ids) => {
    if (!allowed(parent, ids)) return false;
    if (canReparent === undefined || ids.every((id) => nodeOf(id)?.parent === parent)) return true;
    return canReparent(ids, parent);
  };
}

/** What {@link diagramDropParentAt} walks. */
export interface DropParentScene {
  readonly roots: readonly string[];
  childrenOf(id: never): readonly string[];
  get(id: never): { id: string; kind: 'mark' | 'group'; data: unknown; pose: unknown } | undefined;
}

/**
 * The innermost container or lane whose body holds `point`, that would admit
 * a new node of `role` (`null` for a shape): where an insert at `point` goes.
 * Null for the top level — always so for a pool.
 */
export function diagramDropParentAt(
  scene: DropParentScene,
  point: { x: number; y: number },
  role: ContainerRole | null,
): string | null {
  if (role === 'pool' || role === 'lane') return null;
  let best: string | null = null;
  const walk = (ids: readonly string[]): void => {
    for (const id of ids) {
      const node = scene.get(id as never);
      if (node === undefined) continue;
      const trait = diagramContainerOf(node);
      const b = bodyBox(node.pose as { x: number; y: number; width: number; height: number }, trait?.header);
      const inside = point.x >= b.x && point.x < b.x + b.width && point.y >= b.y && point.y < b.y + b.height;
      if (!inside) continue;
      if (trait?.role === 'container' || trait?.role === 'lane') best = id;
      walk(scene.childrenOf(id as never));
    }
  };
  walk(scene.roots);
  return best;
}
