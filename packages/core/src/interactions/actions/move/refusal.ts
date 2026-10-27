import type { OngoingOverlay } from '@weasel-js/routing';
import { poseDescriptorForNode } from 'core/geometry/poseDescriptor';
import { composeWorldPose } from 'core/scene/composePose';
import { scenePoseAdapter } from 'core/scene/scenePoseAdapter';
import type { NodeId } from 'core/scene/types';
import type { Bounds4 } from './layout/container';
import type { MoveSession } from './session';

/** A container the dragged roots are over and may not land in, and the reason it gives. */
export interface MoveRefusal {
  id: NodeId;
  /** Its world bounds. */
  bounds: Bounds4;
  reason: string;
}

/** What a move draws over a refusal: the container's outline, refused, and the reason at the pointer. */
export function refusalOverlays(refusal: MoveRefusal, pointer: { x: number; y: number }): OngoingOverlay[] {
  const { x, y, width, height } = refusal.bounds;
  const points = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }];
  return [
    { kind: 'polyline', points, role: 'refused' },
    { kind: 'reason', at: { x: pointer.x, y: pointer.y }, text: refusal.reason },
  ];
}

/** `id`'s world bounds, as the move measures them. */
export function worldBoundsOf(session: MoveSession, id: NodeId): Bounds4 {
  const node = session.scene.get(id)!;
  const pose = composeWorldPose(scenePoseAdapter(session.scene), id as string, session.pc.compose);
  return poseDescriptorForNode(session.projection, node).getBounds(pose);
}
