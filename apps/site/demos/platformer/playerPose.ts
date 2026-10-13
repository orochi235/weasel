// apps/site/demos/platformer/playerPose.ts
import { bindClip, createTarget, skeletonAxes } from '@weasel-js/animator';
import type { Animator, ClipBinder, Pose, TimelineHandle } from '@weasel-js/animator';
import { sceneClipTargets, type PoseTargetScene } from '@weasel-js/core';
import type { AnimState } from './animState';
import { CLIPS, FADE } from './clips';
import { PLAYER_SKELETON } from './skeleton';

/** The player's pose as an animation target, and the clip playing on it. */
export interface PlayerPose {
  /** The pose to draw. */
  read(): Pose;
  /** Puts the simulation's animation state on the target: once a frame, after stepping. */
  sync(anim: AnimState): void;
  dispose(): void;
}

/**
 * The cross-fade between clips is the target's own arithmetic. A clip is data:
 * `bindClip` gives its track the player's pose as `rig:player` and the state's
 * `fade` as its weight, and whatever a weight leaves short of 1 shows the
 * target's committed pose. Canceling the outgoing clip's timeline
 * commits the pose on screen, whatever mix it was, so the next clip fades in
 * over exactly that and a switch in the middle of a fade cannot pop.
 *
 * The simulation owns the playhead — the run cycle follows ground speed, the
 * airborne clips follow velocity — so each timeline is paused and seeked.
 */
export function createPlayerPose<TPose>(animator: Animator, scene: PoseTargetScene<TPose>): PlayerPose {
  let committed: Pose = {};
  const target = createTarget<Pose>({
    get: () => committed,
    set: (pose) => { committed = pose; },
    axes: skeletonAxes(PLAYER_SKELETON),
  });
  let anim: AnimState | null = null;
  let clip: TimelineHandle | null = null;
  const binder: ClipBinder = {
    target: sceneClipTargets(scene, { rigs: { player: { target } } }),
    weight: (name) => (name === FADE ? () => anim!.fade : undefined),
  };

  return {
    read: () => target.read(),
    sync(next) {
      if (next.switches !== anim?.switches) {
        clip?.cancel();
        clip = animator.timeline({ ...bindClip(CLIPS[next.current], binder), label: next.current, autoplay: false });
      }
      anim = next;
      clip!.seek(next.phase);
    },
    dispose() {
      clip?.cancel();
      clip = null;
      anim = null;
    },
  };
}
