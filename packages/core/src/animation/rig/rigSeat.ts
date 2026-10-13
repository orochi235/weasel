import type { GlMat3 } from '@weasel-js/geom';
import { createTarget, skeletonAxes, type Pose, type Skeleton, type Target } from '@weasel-js/animator';

/** One binding of a rig to the scene: what a seat shows its pose through. */
export interface RigBinding {
  show(pose: Pose): void;
  /** Drop the overrides, leaving the seat as it is. */
  drop(): void;
}

/**
 * A rig's pose apart from the binding that shows it: the target, the committed pose, and the
 * placement. A rig bound again on the seat it had goes on under the animations running on its
 * target.
 */
export interface RigSeat {
  readonly target: Target<Pose>;
  committed: Pose;
  root: GlMat3 | undefined;
  binding: RigBinding | null;
  /** Whether the pose is on screen: set as a binding shows it, cleared as the rig is released. */
  shown: boolean;
}

/** A seat at the bind pose, for a skeleton with these joints in this order. */
export function createRigSeat(skeleton: Skeleton): RigSeat {
  const seat: RigSeat = {
    committed: {},
    root: undefined,
    binding: null,
    shown: false,
    target: createTarget<Pose>({
      get: () => seat.committed,
      set: (pose) => { seat.committed = pose; },
      axes: skeletonAxes(skeleton),
      show: (pose) => seat.binding?.show(pose),
    }),
  };
  return seat;
}

/** Make `binding` the one `seat` shows through, and show it what the last one had on screen. */
export function seatBinding(seat: RigSeat, binding: RigBinding): void {
  seat.binding = binding;
  if (seat.shown) binding.show(seat.target.read());
}
