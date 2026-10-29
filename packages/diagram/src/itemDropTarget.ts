/**
 * Where an item carried in from outside the canvas would land: the shape or
 * container under the pointer, the container that would hold it, and its
 * place among that container's members.
 */
import type { Bounds, OngoingOverlay, RectPose, Scene, Vec2 } from '@weasel-js/core';
import { nearestGap } from '@weasel-js/headless';
import { bodyAt } from './connectTargets';
import { diagramDropParentAt, type DropParentScene } from './containers/canDropInto';
import { diagramContainerOf } from './containers/trait';
import type { DiagramSceneData } from './fromData';
import { worldRectOf } from './overlays';
import type { ParticipantSource } from './portAffordance';
import { sequenceSlots, type ReorderGap } from './reorder';
import { membersOf } from './reorderModel';

/** Where a carried item is over. */
export interface ItemDropTarget {
  /** The shape or the container it would be dropped on, or `null` for the bare canvas. */
  target: string | null;
  /** The container or lane that would hold it: the target when that is one,
   *  else the one around the pointer. `null` at the top level. */
  container: string | null;
  /** Its place among `container`'s members, as they stand along the
   *  container's `reorder` axis, else in reading order: top to bottom, then
   *  left to right. `null` with no container. */
  index: number | null;
  /** The pointer, in world units. */
  at: Vec2;
}

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

/** A container's members as they stand, and the gap the pointer is nearest along `axis`, or by reading order. */
function placeAmong(scene: DiagramScene, container: string, at: Vec2): { index: number; gap: ReorderGap | null } {
  const axis = diagramContainerOf(scene.get(container as never)!)?.reorder;
  const boxed = membersOf(scene as never, container).flatMap((id) => {
    const bounds = worldRectOf(scene, id);
    return bounds === null ? [] : [{ id, bounds }];
  });
  if (axis === undefined) {
    const before = (b: Bounds) => at.y > b.y + b.height || (at.y >= b.y && at.x > b.x + b.width / 2);
    return { index: boxed.filter((m) => before(m.bounds)).length, gap: null };
  }
  const slots = sequenceSlots(axis, [...boxed].sort((p, q) => p.bounds[axis] - q.bounds[axis]));
  const gap = slots.gaps[nearestGap(slots.gaps.map((g) => g.a[axis]), at[axis])] ?? null;
  return { index: gap?.index ?? 0, gap };
}

/** What `at` is over, and the insertion bar to draw there in a reorderable container. */
export function itemDropTargetAt(
  scene: DiagramScene,
  participants: ParticipantSource<RectPose>,
  at: Vec2,
): ItemDropTarget & { gap: ReorderGap | null } {
  const point = { x: at.x, y: at.y };
  const hit = bodyAt(participants, point);
  const node = hit !== null && diagramContainerOf(hit.participant.node) === null ? hit.end.nodeId : null;
  const container = diagramDropParentAt(scene as unknown as DropParentScene, point, null);
  const place = container === null ? null : placeAmong(scene, container, point);
  return { target: node ?? container, container, index: place?.index ?? null, at: point, gap: place?.gap ?? null };
}

/** The outline of `id`'s box, as a closed run. */
export function outlineOf(scene: DiagramScene, id: string, role: string): OngoingOverlay | null {
  const b = worldRectOf(scene, id);
  if (b === null) return null;
  const points = [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }, { x: b.x, y: b.y }];
  return { kind: 'polyline', points, role };
}
