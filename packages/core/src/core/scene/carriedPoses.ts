import type { Op } from 'core/ops/types';
import type { NodeId } from './types';

/** The name a recorded op serializes under once it has carried poses. */
export const CARRY_OP = 'carry';

/** One pose an op changed, its own write or one carried for it. */
export interface CarriedPose<TPose> {
  id: NodeId;
  from: TPose;
  to: TPose;
}

/** The args of a serialized {@link CARRY_OP}: the op it stands for, and every
 *  pose that op changed when it first applied. */
export interface CarryArgs<TPose> {
  /** The inner op's own `id`, where it has one, for the history engine's
   *  touched-id bookkeeping. */
  id?: string;
  op: { name: string; args: unknown };
  poses: CarriedPose<TPose>[];
}

interface Noting<TPose> {
  poses: Map<NodeId, CarriedPose<TPose>>;
  carried: boolean;
}

/** `null` until the op has applied once; empty when it carried nothing. */
interface Recorded<TPose> {
  poses: CarriedPose<TPose>[] | null;
}

export interface CarriedPoses<TPose> {
  /** Called by the scene with every pose it writes. */
  wrote(id: NodeId, from: TPose, to: TPose): void;
  /** Whether a `scene.carry` should write: false while an op that recorded
   *  its carried poses replays, since it restores them itself. */
  carries(): boolean;
  /** `op`, recording the poses it changes if any of them is carried. */
  recording(op: Op): Op;
  /** The op a serialized {@link CARRY_OP} stands for. */
  rebuilt(inner: Op, poses: CarriedPose<TPose>[]): Op;
}

/**
 * Poses written on behalf of an op that the op's own inverse knows nothing
 * about, such as the descendants a cascading adapter moves with a container.
 *
 * Working the same write out again on the way back reads different poses and
 * lands somewhere else. So an op that carries poses records every pose it
 * changes, and its replay in either direction puts those poses where they
 * were, with carrying turned off.
 */
export function createCarriedPoses<TPose>(
  has: (id: NodeId) => boolean,
  write: (id: NodeId, pose: TPose) => void,
): CarriedPoses<TPose> {
  let noting: Noting<TPose> | null = null;
  let replaying = 0;

  const first = (op: Op, state: Recorded<TPose>, adapter: unknown): ReturnType<Op['apply']> => {
    const outer = noting;
    const mine: Noting<TPose> = { poses: new Map(), carried: false };
    noting = mine;
    try {
      return op.apply(adapter);
    } finally {
      noting = outer;
      state.poses = mine.carried ? [...mine.poses.values()] : [];
    }
  };

  const replay = (op: Op, poses: CarriedPose<TPose>[], forward: boolean, adapter: unknown): ReturnType<Op['apply']> => {
    replaying++;
    try {
      const result = op.apply(adapter);
      for (const p of poses) if (has(p.id)) write(p.id, forward ? p.to : p.from);
      return result;
    } finally {
      replaying--;
    }
  };

  const wrap = (op: Op, state: Recorded<TPose>, forward: boolean): Op => {
    const carried = (): boolean =>
      forward && op.name !== undefined && state.poses !== null && state.poses.length > 0;
    return {
      get name() { return carried() ? CARRY_OP : op.name; },
      get args() {
        if (!carried()) return op.args;
        const id = (op.args as { id?: unknown } | null | undefined)?.id;
        const args: CarryArgs<TPose> = {
          ...(typeof id === 'string' ? { id } : {}),
          op: { name: op.name!, args: op.args },
          poses: state.poses!,
        };
        return args;
      },
      label: op.label,
      get coalesceKey() { return op.coalesceKey; },
      elideNoop: op.elideNoop,
      apply(adapter) {
        if (state.poses === null) return first(op, state, adapter);
        if (state.poses.length === 0) return op.apply(adapter);
        return replay(op, state.poses, forward, adapter);
      },
      invert: () => wrap(op.invert(), state, !forward),
    };
  };

  return {
    wrote(id, from, to) {
      if (!noting) return;
      const noted = noting.poses.get(id);
      if (noted) noted.to = to;
      else noting.poses.set(id, { id, from, to });
    },
    carries() {
      if (noting) noting.carried = true;
      return replaying === 0;
    },
    recording: (op) => wrap(op, { poses: null }, true),
    rebuilt: (inner, poses) => wrap(inner, { poses }, true),
  };
}
