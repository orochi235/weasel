import type { NodeClip, NodeId, SceneNode } from '@weasel-js/core';
import type { UnitScope } from '@weasel-js/quantity';

/** The scene methods that record a declared field. */
interface DeclaredWrites {
  setClip(id: NodeId, clip: NodeClip | null): void;
  setUnits(id: NodeId, units: UnitScope | null): void;
}

/** A node's field that a schema key can name outright: what the node declares for its children, stored
 *  beside `pose` and `data` and written through the scene method that records it. */
interface DeclaredField {
  write(scene: DeclaredWrites, id: NodeId, value: unknown): void;
}

const DECLARED: Readonly<Record<string, DeclaredField>> = {
  clip: { write: (scene, id, value) => scene.setClip(id, (value ?? null) as NodeClip | null) },
  units: { write: (scene, id, value) => scene.setUnits(id, (value ?? null) as UnitScope | null) },
};

/** The declared field a path's first segment names, if it names one. */
export const declaredField = (head: string | undefined): DeclaredField | undefined =>
  head !== undefined && Object.hasOwn(DECLARED, head) ? DECLARED[head] : undefined;

/** What `node` holds in the field a path's first segment names: `pose`, `data`, or a declared field. */
export function nodeRoot(node: SceneNode<unknown, string, unknown>, head: string | undefined): unknown {
  if (head === 'pose') return node.pose;
  if (head === 'data') return node.data;
  return declaredField(head) ? (node as unknown as Record<string, unknown>)[head!] : undefined;
}
