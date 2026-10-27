import type { NodeId, Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { documentPose } from 'core/scene/effectivePose';
import { composeChildFrame, frameAtOrAbove, rebaseLocalPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { ReflowTransition } from '../../../../layout/types';
import type { MoveSession } from '../session';

/** Hold a node still gliding from an earlier reflow where it is shown. Returns
 *  how far that stands from its document pose, or null when it is not gliding. */
export function catchGliding(
  scene: Scene<unknown, string, unknown>,
  reflow: ReflowTransition | null,
  projection: PoseDescriptor<unknown>,
  id: NodeId,
): { dx: number; dy: number } | null {
  const shown = reflow?.poseOf(id as string);
  if (!reflow || shown === undefined) return null;
  reflow.glide(id as string, shown, { from: shown });
  const at = projection.getBounds(shown);
  const home = projection.getBounds(documentPose(scene, scene.get(id)!));
  return { dx: at.x - home.x, dy: at.y - home.y };
}

/** Send this frame's reflow targets gliding and settle what stopped reflowing. */
export function stepGlide(reflow: ReflowTransition, gliding: Set<NodeId>, targets: ReadonlyMap<NodeId, unknown>): void {
  for (const [id, pose] of targets) {
    reflow.glide(id as string, pose);
    gliding.add(id);
  }
  for (const id of gliding) {
    if (targets.has(id)) continue;
    reflow.settle(id as string);
    gliding.delete(id);
  }
}

/** Where a dragged id was shown when the gesture ended: its stored pose then,
 *  the parent that pose was stored under, and the same pose in world. */
export interface Released {
  local: unknown;
  parent: NodeId | null;
  world: unknown;
}

export function releasedPoses(session: MoveSession, previews: ReadonlyMap<NodeId, unknown>): Map<NodeId, Released> {
  const out = new Map<NodeId, Released>();
  const { scene, pc } = session;
  const adapter = sceneViewPoseAdapter(scene);
  for (const id of session.startPoses.keys()) {
    const local = previews.get(id);
    if (local === undefined) continue;
    const parent = scene.get(id)?.parent ?? null;
    const frame = frameAtOrAbove(adapter, parent);
    const world = frame === null ? local : pc.compose(composeChildFrame(adapter, frame, pc.compose), local);
    out.set(id, { local, parent, world });
  }
  return out;
}

/** Hand every dragged id to the reflow transition to glide from where it was
 *  let go onto the pose the document now holds. An id caught mid-glide that
 *  never moved resumes settling from where it was held. */
export function landReleased(
  session: MoveSession,
  reflow: ReflowTransition,
  released: Map<NodeId, Released>,
): void {
  const { scene, pc } = session;
  const adapter = sceneViewPoseAdapter(scene);
  for (const id of session.startPoses.keys()) {
    const r = released.get(id);
    if (!r) {
      if (session.caught.has(id)) reflow.settle(id as string);
      continue;
    }
    const parent = scene.get(id)?.parent ?? null;
    const from = parent === r.parent
      ? r.local
      : rebaseLocalPose(adapter, r.world, parent, pc.compose, pc.decompose);
    reflow.settle(id as string, { from });
  }
}
