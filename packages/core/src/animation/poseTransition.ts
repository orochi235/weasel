import { useEffect, useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { PoseRemoval, PoseWrite, ScenePoseReports } from '../core/scene/poseWrites';
import type { NodeId, PoseOverrides } from '../core/scene/types';
import type { ReflowTransition } from '../layout/types';
import { createDepartures, type Departures } from './departures';

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
  /** Where a node the scene removes is seen off to, given the pose it was
   *  shown at: a ghost of it glides there fading out, drawn but never picked,
   *  selected or recorded. Absent, a removed node vanishes. Needs a
   *  transition from `useAnimatedReflow` or `createReflowTransition`. */
  exit?: (pose: TPose) => TPose;
  /** Whether a removal is seen off through `exit`. Default: every one but
   *  an untracked removal. */
  exits?: (removal: PoseRemoval<TPose>) => boolean;
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

const exitsByDefault = (removal: PoseRemoval<unknown>): boolean => removal.origin !== 'untracked';

/** The part of a scene a pose transition hears and reads. */
export interface PoseTransitionScene<TPose, TNode = unknown> extends Pick<ScenePoseReports<TPose, TNode>, 'onPoseWrite'> {
  readonly overrides: Pick<PoseOverrides<TPose>, 'has'>;
}

/** Hand `scene`'s pose writes to the seat's transition, each gliding from the
 *  pose it was shown at. A node something else is showing through an override
 *  — a drag's preview, another animation — is left to it. With `departures`,
 *  removals leave as ghosts there, and a node that comes back while its ghost
 *  is leaving returns from where the ghost was. */
export function bindPoseTransition<TPose, TNode = unknown>(
  scene: PoseTransitionScene<TPose, TNode>,
  seat: () => PoseTransitionSeat<TPose> | null | undefined,
  departures?: Departures<TPose, TNode>,
): () => void {
  return scene.onPoseWrite((writes, removed) => {
    const s = seat();
    if (!s) return;
    const glides = s.glides ?? glidesByDefault;
    const t = s.transition;
    for (const r of removed) {
      t.stop(r.id as string);
      if (s.exit && departures && (s.exits ?? exitsByDefault)(r)) departures.leave(r, s.exit, t);
    }
    for (const w of writes) {
      const id = w.id as string;
      const back = w.from === undefined ? departures?.recall(id) : undefined;
      if (!glides(w)) continue;
      // One already gliding turns toward the new pose from where it is shown.
      if (t.poseOf(id) !== undefined) {
        t.settle(id);
        continue;
      }
      if (scene.overrides.has(w.id as NodeId)) continue;
      const from = w.from ?? back ?? s.enter?.(w.to);
      if (from !== undefined) t.settle(id, { from });
    }
  });
}

/** {@link bindPoseTransition} for a component's life, following the latest
 *  seat. Subscribes only while there is one. Answers the ghosts it shows. */
export function usePoseTransition<TPose, TNode = unknown>(
  scene: PoseTransitionScene<TPose, TNode>,
  seat: PoseTransitionSeat<TPose> | null | undefined,
): Departures<TPose, TNode> {
  const latest = useLatest(seat);
  const on = !!seat;
  const departures = useMemo(() => createDepartures<TPose, TNode>(), []);
  useEffect(() => () => departures.dispose(), [departures]);
  useEffect(
    () => (on ? bindPoseTransition(scene, () => latest.current, departures) : undefined),
    [on, scene, latest, departures],
  );
  return departures;
}
