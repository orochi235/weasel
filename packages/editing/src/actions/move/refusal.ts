import type { OngoingOverlay } from '@weasel-js/routing';
import { poseDescriptorForNode, composeWorldPose, sceneViewPoseAdapter } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/core';
import type { MoveSession } from './session';
import type { Rect } from '@weasel-js/geom';

/** A container the dragged roots are over and may not land in, and the reason it gives. */
export interface MoveRefusal {
  id: NodeId;
  /** Its world bounds. */
  bounds: Rect;
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
export function worldBoundsOf(session: MoveSession, id: NodeId): Rect {
  const node = session.scene.get(id)!;
  const pose = composeWorldPose(sceneViewPoseAdapter(session.scene), id as string, session.pc.compose);
  return poseDescriptorForNode(session.projection, node).getBounds(pose);
}
