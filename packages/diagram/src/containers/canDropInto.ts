import { diagramEdgeOf } from '../edgeTrait';
import { diagramLabelOf } from '../labelTrait';
import { dataKeyReader } from '../trait';
import { bodyBox, diagramContainerOf, type ContainerRole } from './trait';

type SceneLike = { get(id: never): { id: string; kind: 'leaf' | 'container'; data: unknown } | undefined };

/**
 * The `canDropInto` dep for a diagram scene. A container or a lane takes
 * shapes and other containers, a pool takes only lanes, and a lane goes
 * nowhere but a pool. A stencil body, an edge, or a label takes nothing, and
 * edges and labels are never dropped in: they stay where they are, drawn from
 * what they are attached to. Any other container — a plain group — takes
 * anything but a lane.
 */
export function diagramCanDropInto(scene: SceneLike): (parent: string, ids: readonly string[]) => boolean {
  const nodeOf = (id: string) => scene.get(id as never);
  const roleOf = (id: string) => {
    const node = nodeOf(id);
    return node === undefined ? null : diagramContainerOf(node)?.role ?? null;
  };
  const attached = (id: string) => {
    const node = nodeOf(id);
    return node !== undefined && (diagramEdgeOf(node) !== null || diagramLabelOf(node) !== null);
  };
  return (parent, ids) => {
    const node = nodeOf(parent);
    if (node === undefined || ids.some(attached)) return false;
    const role = roleOf(parent);
    if (role === 'pool') return ids.every((id) => roleOf(id) === 'lane');
    if (ids.some((id) => roleOf(id) === 'lane')) return false;
    if (role !== null) return ids.every((id) => roleOf(id) !== 'pool');
    return !attached(parent) && dataKeyReader(node) === null;
  };
}

/** What {@link diagramDropParentAt} walks. */
export interface DropParentScene {
  readonly roots: readonly string[];
  childrenOf(id: never): readonly string[];
  get(id: never): { id: string; kind: 'leaf' | 'container'; data: unknown; pose: unknown } | undefined;
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
      if (node === undefined || node.kind !== 'container') continue;
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
