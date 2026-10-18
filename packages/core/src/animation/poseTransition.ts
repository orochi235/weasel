import { useEffect } from 'react';
import { useLatest } from '@weasel-js/react';
import type { PoseWrite, ScenePoseReports } from '../core/scene/poseWrites';
import type { NodeId, PoseOverrides } from '../core/scene/types';
import type { ReflowTransition } from '../layout/types';

/**
 * Which pose writes a canvas glides, and through what: `<SceneCanvas
 * poseTransition>`. The transition is the kind `reflowTransition` takes, and
 * one object can serve both.
 */
export interface PoseTransitionSeat<TPose> {
  /** Shows each glide through a pose override; writes nothing. */
  transition: ReflowTransition<TPose>;
  /** Whether `write` glides. Default {@link glidesByDefault}. */
  glides?: (write: PoseWrite<TPose>) => boolean;
  /** Where a node the scene adds is first shown, given the pose it was added
   *  at. Absent, an added node appears in place. */
  enter?: (pose: TPose) => TPose;
}

/**
 * The writes a {@link PoseTransitionSeat} glides unless told otherwise: a
 * direct scene call, an undo, and a redo. An action's commit (`'ops'`) is
 * left out because most show their own result — a drag's release is already
 * where it is written — and `tweenPose` records its op before it animates.
 * Layout writes belong to `reflowTransition`.
 */
export function glidesByDefault(write: PoseWrite<unknown>): boolean {
  return write.origin === 'call' || write.origin === 'undo' || write.origin === 'redo';
}

/** The part of a scene a pose transition hears and reads. */
export interface PoseTransitionScene<TPose> extends Pick<ScenePoseReports<TPose>, 'onPoseWrite'> {
  readonly overrides: Pick<PoseOverrides<TPose>, 'has'>;
}

/** Hand `scene`'s pose writes to the seat's transition, each gliding from the
 *  pose it was shown at. A node something else is showing through an override
 *  — a drag's preview, another animation — is left to it. */
export function bindPoseTransition<TPose>(
  scene: PoseTransitionScene<TPose>,
  seat: () => PoseTransitionSeat<TPose> | null | undefined,
): () => void {
  return scene.onPoseWrite((writes) => {
    const s = seat();
    if (!s) return;
    const glides = s.glides ?? glidesByDefault;
    const t = s.transition;
    for (const w of writes) {
      if (!glides(w)) continue;
      const id = w.id as string;
      // One already gliding turns toward the new pose from where it is shown.
      if (t.poseOf(id) !== undefined) {
        t.settle(id);
        continue;
      }
      if (scene.overrides.has(w.id as NodeId)) continue;
      const from = w.from ?? s.enter?.(w.to);
      if (from !== undefined) t.settle(id, { from });
    }
  });
}

/** {@link bindPoseTransition} for a component's life, following the latest
 *  seat. Subscribes only while there is one. */
export function usePoseTransition<TPose>(
  scene: PoseTransitionScene<TPose>,
  seat: PoseTransitionSeat<TPose> | null | undefined,
): void {
  const latest = useLatest(seat);
  const on = !!seat;
  useEffect(() => (on ? bindPoseTransition(scene, () => latest.current) : undefined), [on, scene, latest]);
}
