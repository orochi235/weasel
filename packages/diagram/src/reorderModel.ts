/**
 * Which members a reorderable group holds, and what moves with each. Plain
 * reads of the scene; `groupReorder.ts` builds a reorder's slots from them.
 */
import type { Bounds } from '@weasel-js/core';
import { diagramAnchorOf, diagramGroupOf } from './group';
import { diagramLabelOf } from './labelTrait';

/** The scene reads a reorder makes. */
export interface ReorderScene {
  get(id: string): { id: string; data: unknown; dependsOn?: unknown } | undefined;
  renderOrderNodes(): Iterable<{ id: string; data: unknown; dependsOn?: unknown }>;
  /** A container's children, which a reorder carries with it. Absent, every node is a leaf. */
  childrenOf?(id: string): readonly string[];
}

/** A group whose members are carried along one axis, and the member a press picked up. */
export interface ReorderTarget {
  group: string;
  axis: 'x' | 'y';
  member: string;
  /** The group's members, in the order they stand along the axis. */
  members: readonly string[];
}

const depsOf = (node: { dependsOn?: unknown } | undefined): string[] =>
  Array.isArray(node?.dependsOn) ? (node.dependsOn as string[]) : [];

/** The group box directly holding each node or group. A wire label a box takes in is not one of its members. */
function holders(scene: ReorderScene): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of scene.renderOrderNodes()) {
    if (diagramGroupOf(node) === null) continue;
    for (const dep of depsOf(node)) {
      const member = scene.get(dep);
      if (member !== undefined && diagramLabelOf(member) === null) out.set(dep, node.id);
    }
  }
  return out;
}

/** The members of group `group`, the way {@link holders} counts them. */
function membersOf(scene: ReorderScene, group: string): string[] {
  return depsOf(scene.get(group)).filter((id) => {
    const node = scene.get(id);
    return node !== undefined && diagramLabelOf(node) === null;
  });
}

/**
 * The reorderable group a press on `id` carries a member of: the nearest
 * group above `id` with `reorder` set, and its member on the way up — `id`
 * itself, or the group holding it. `null` when no group above it reorders.
 */
export function reorderTargetOf(
  scene: ReorderScene,
  id: string,
  boxOf: (id: string) => Bounds | null,
): ReorderTarget | null {
  const held = holders(scene);
  for (let member = id, group = held.get(id); group !== undefined; member = group, group = held.get(group)) {
    const axis = diagramGroupOf(scene.get(group)!)?.reorder;
    if (axis === undefined) continue;
    const start = (m: string) => {
      const box = boxOf(m);
      return box === null ? 0 : axis === 'x' ? box.x : box.y;
    };
    const members = membersOf(scene, group).sort((a, b) => start(a) - start(b));
    return { group, axis, member, members };
  }
  return null;
}

/** `member` and everything drawn with it: a group's members and the labels it
 *  takes in, all the way down, every container's children, and every node
 *  anchored to any of those. */
export function carriedWith(scene: ReorderScene, member: string): Set<string> {
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    const node = scene.get(id);
    if (node !== undefined && diagramGroupOf(node) !== null) depsOf(node).forEach(visit);
    scene.childrenOf?.(id).forEach(visit);
  };
  visit(member);
  for (const node of scene.renderOrderNodes()) {
    const on = depsOf(node)[0];
    if (on !== undefined && out.has(on) && diagramAnchorOf(node) !== null) out.add(node.id);
  }
  return out;
}
