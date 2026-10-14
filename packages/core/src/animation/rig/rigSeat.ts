import type { GlMat3 } from '@weasel-js/geom';
import { createTarget, skeletonAxes, type Pose, type Skeleton, type Target } from '@weasel-js/animator';

/** One binding of a rig to the scene: what a seat shows its pose through. */
export interface RigBinding {
  show(pose: Pose): void;
  /** Drop the overrides, leaving the seat as it is. */
  drop(): void;
}

/** The seat another took over from, while something still moves its target. */
interface Carried {
  seat: RigSeat;
  /** That seat's target as it read when this one was made, as its axes. */
  from: number[];
  /** For each axis of this seat, that seat's axis of the same name; -1 where it has none. */
  axis: number[];
}

/**
 * A rig's pose apart from the binding that shows it: the target, the committed pose, and the
 * placement. A rig bound again on the seat it had goes on under the animations running on its
 * target.
 */
export interface RigSeat {
  readonly target: Target<Pose>;
  /** The committed pose, less what `carried` adds to it. */
  committed: Pose;
  root: GlMat3 | undefined;
  binding: RigBinding | null;
  /** Whether the pose is on screen: set as a binding shows it, cleared as the rig is released. */
  shown: boolean;
  /** The seat this one took over from as the skeleton's joints changed. What moves that
   *  seat's target since then is added to this one's, on the joints both skeletons name. */
  carried: Carried | null;
}

const moving = (seat: RigSeat): boolean =>
  seat.target.active || (seat.carried !== null && moving(seat.carried.seat));

/** How far `carried`'s target has moved since it was taken over from, in the new seat's axes. */
function travel(carried: Carried): number[] {
  const { target } = carried.seat;
  const now = target.axes.to(target.read());
  return carried.axis.map((k) => (k < 0 ? 0 : now[k]! - carried.from[k]!));
}

/** The joints of `pose` that `skeleton` names. */
function jointsOf(pose: Pose, skeleton: Skeleton): Pose {
  const out: Pose = {};
  for (const { name } of skeleton.joints) {
    const joint = pose[name];
    if (joint) out[name] = joint;
  }
  return out;
}

/**
 * A seat for a skeleton with these joints in this order. With no `prior` it is at the bind
 * pose. With one, it takes over where that seat stands: its placement, and its pose on the
 * joints `skeleton` still names. Animations go on running on the prior seat's target, and
 * this one shows them.
 */
export function createRigSeat(skeleton: Skeleton, prior?: RigSeat): RigSeat {
  const axes = skeletonAxes(skeleton);
  const shifted = (pose: Pose, by: number[], sign: 1 | -1): Pose =>
    axes.from(axes.to(pose).map((v, i) => v + sign * by[i]!));
  const seat: RigSeat = {
    committed: prior ? jointsOf(prior.target.read(), skeleton) : {},
    root: prior?.root,
    binding: null,
    shown: prior?.shown ?? false,
    carried: prior && moving(prior) ? carry(prior, axes.names ?? []) : null,
    target: createTarget<Pose>({
      get: () => {
        const { carried } = seat;
        if (!carried) return seat.committed;
        const pose = shifted(seat.committed, travel(carried), 1);
        if (!moving(carried.seat)) {
          seat.committed = pose;
          seat.carried = null;
        }
        return pose;
      },
      set: (pose) => {
        const { carried } = seat;
        seat.committed = carried ? shifted(pose, travel(carried), -1) : pose;
      },
      axes,
      show: (pose) => seat.binding?.show(pose),
    }),
  };
  return seat;
}

function carry(prior: RigSeat, names: readonly string[]): Carried {
  const { target } = prior;
  const had = target.axes.names ?? [];
  return { seat: prior, from: target.axes.to(target.read()), axis: names.map((name) => had.indexOf(name)) };
}

/** Make `binding` the one `seat` shows through, and show it what the last one had on screen.
 *  A seat it took over from shows through it too. */
export function seatBinding(seat: RigSeat, binding: RigBinding): void {
  seat.binding = binding;
  const prior = seat.carried?.seat;
  if (prior) prior.binding = { show: () => seat.binding?.show(seat.target.read()), drop: () => {} };
  if (seat.shown) binding.show(seat.target.read());
}
