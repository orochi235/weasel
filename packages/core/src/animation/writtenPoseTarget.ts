import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import { liveAxes } from './poseTarget';
import { createTarget, type Target } from './target';

/** What {@link createWrittenPoseTarget} takes. */
export interface WrittenPoseTargetOptions<TPose> {
  /** The pose the store holds for the node, or undefined once the node is gone. */
  read(): TPose | undefined;
  /** Writes the node's pose to the store. */
  write(pose: TPose): void;
  /** Supplies the pose's axes, as for `createPoseTarget`. */
  descriptor?: PoseDescriptor<TPose>;
  /** Called each time the node comes to rest. */
  onRest?(): void;
}

/**
 * A {@link Target} over a pose whose store holds one value and has no overrides table to show a
 * moving pose through: an array in React state, a plain record. While the node moves, the
 * committed pose is kept here and the store is written the pose on screen each frame; at rest
 * the store holds the committed pose again.
 *
 * Something else writing the store mid-flight is not seen, and the next frame writes over it.
 * Null for a node the store does not hold, or a pose with no axes.
 */
export function createWrittenPoseTarget<TPose>(opts: WrittenPoseTargetOptions<TPose>): Target<TPose> | null {
  const first = opts.read();
  if (first === undefined) return null;
  let last = first;
  /** The committed pose while it is apart from the store's; null while the store holds it. */
  let committed: TPose | null = null;
  const get = (): TPose => {
    if (committed !== null) return committed;
    last = opts.read() ?? last;
    return last;
  };
  const axes = liveAxes(opts.descriptor, get);
  if (!axes) return null;
  const target: Target<TPose> = createTarget<TPose>({
    axes,
    get,
    set(pose) {
      if (target.active) {
        committed = pose;
        return;
      }
      committed = null;
      opts.write(pose);
    },
    show(pose) {
      if (target.active) {
        if (committed === null) committed = get();
        opts.write(pose);
        return;
      }
      const landed = committed;
      committed = null;
      if (landed !== null) opts.write(landed);
      opts.onRest?.();
    },
  });
  return target;
}
