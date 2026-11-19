import { tweenPose, type PoseAnimationAdapter } from '../poseHelpers';
import { setPoseInstant } from './instantPose';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { AnimationHandle, Animator, EasingSpec } from '@weasel-js/animator';

/** How nodes enter and leave. `enterFrom` derives the pose a new node starts
 *  at, given where it belongs; `exitTo` derives the pose a departing node
 *  animates to before it is actually removed. Omit either to leave that
 *  transition instant. */
export interface LifecycleAnimation<TPose> {
  /** Pose to animate the new object FROM at insert. */
  enterFrom?: (final: TPose) => TPose;
  /** Pose to animate the existing object TO at remove. */
  exitTo?: (current: TPose) => TPose;
  ms?: number;
  easing?: EasingSpec;
  geometry?: PoseDescriptor<TPose>;
}

/** The part of an adapter `animateLifecycle` reads and wraps. The adapter `sceneToAdapter` and
 *  `useSceneAdapter` build is one. */
export interface LifecycleAdapter<TNode extends { id: string }, TPose> extends PoseAnimationAdapter<TPose> {
  insertNode(node: TNode, index?: number): void;
  removeNode(id: string): void;
}

/** Wrap an adapter so inserts and removals animate — the scene-graph
 *  equivalent of CSS enter/leave transitions. The result is the adapter it
 *  was given, with `insertNode` and `removeNode` replaced. */
export function animateLifecycle<
  TNode extends { id: string },
  TPose,
  A extends LifecycleAdapter<TNode, TPose> = LifecycleAdapter<TNode, TPose>,
>(
  adapter: A & LifecycleAdapter<TNode, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): A {
  const ms = opts.ms ?? 200;
  /** Each node whose exit is running, with what calls that exit off. */
  const leaving = new Map<string, () => void>();

  return {
    ...adapter,
    insertNode(object: TNode, index?: number): void {
      // A node back before its exit ended stays: the pending removal is dropped.
      leaving.get(object.id)?.();
      adapter.insertNode(object, index);
      if (!opts.enterFrom) return;
      const final = adapter.getPose(object.id);
      const start = opts.enterFrom(final);
      // A pose target shows the start pose itself; without one it has to be written.
      const written = !adapter.poseTarget?.(object.id, opts.geometry);
      if (written) setPoseInstant(adapter, object.id, start);
      try {
        tweenPose(animator, adapter, {
          id: object.id,
          from: start,
          to: final,
          ms,
          easing: opts.easing,
          geometry: opts.geometry,
          recordOp: false,
        });
      } catch (error) {
        if (written) setPoseInstant(adapter, object.id, final);
        throw error;
      }
    },
    removeNode(id: string): void {
      if (!opts.exitTo) {
        adapter.removeNode(id);
        return;
      }
      if (leaving.has(id)) return;
      let unwatch = (): void => {};
      let handle: AnimationHandle | undefined;
      const target = adapter.poseTarget?.(id, opts.geometry);
      const home = target?.committed();
      const current = adapter.getPose(id);
      const restore = (): void => {
        if (target) target.commit(home as TPose);
        else setPoseInstant(adapter, id, current);
      };
      const end = (): boolean => {
        if (leaving.get(id) !== callOff) return false;
        leaving.delete(id);
        unwatch();
        return true;
      };
      const callOff = (): void => {
        if (!end()) return;
        handle?.cancel();
        restore();
      };
      const remove = (): void => {
        if (!end()) return;
        // The exit pose was only for show: the node is removed as it stood, so undo restores that.
        restore();
        adapter.removeNode(id);
      };
      leaving.set(id, callOff);
      try {
        handle = tweenPose(animator, adapter, {
          id,
          to: opts.exitTo(current),
          ms,
          easing: opts.easing,
          geometry: opts.geometry,
          recordOp: false,
          onDone: remove,
        });
      } catch (error) {
        leaving.delete(id);
        throw error;
      }
      const exit = handle;
      // A canceled tween never calls onDone, and the node still has to go.
      unwatch = animator.watch((event) => {
        if ((event.type === 'cancel' || event.type === 'interrupt') && event.animation.id === exit.id) remove();
      });
    },
  } as A;
}
