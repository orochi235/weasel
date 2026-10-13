import { tweenPose, type PoseAnimationAdapter } from '../poseHelpers';
import { setPoseInstant } from './instantPose';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { Animator, EasingSpec } from '@weasel-js/animator';

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

/** The part of an adapter `animateLifecycle` reads and wraps. Any `SceneAdapter` is one, and so is
 *  the adapter `sceneToAdapter` and `useSceneAdapter` build. */
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
  const leaving = new Set<string>();

  return {
    ...adapter,
    insertNode(object: TNode, index?: number): void {
      adapter.insertNode(object, index);
      if (!opts.enterFrom) return;
      const final = adapter.getPose(object.id);
      const start = opts.enterFrom(final);
      // A pose target shows the start pose itself; without one it has to be written.
      if (!adapter.poseTarget?.(object.id, opts.geometry)) setPoseInstant(adapter, object.id, start);
      tweenPose(animator, adapter, {
        id: object.id,
        from: start,
        to: final,
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
      });
    },
    removeNode(id: string): void {
      if (!opts.exitTo) {
        adapter.removeNode(id);
        return;
      }
      if (leaving.has(id)) return;
      leaving.add(id);
      let unwatch = (): void => {};
      const target = adapter.poseTarget?.(id, opts.geometry);
      const home = target?.committed();
      const remove = (): void => {
        if (!leaving.delete(id)) return;
        unwatch();
        // The exit pose was only for show: the node is removed as it stood, so undo restores that.
        if (target) target.commit(home as TPose);
        adapter.removeNode(id);
      };
      const current = adapter.getPose(id);
      const handle = tweenPose(animator, adapter, {
        id,
        to: opts.exitTo(current),
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
        onDone: remove,
      });
      // A canceled tween never calls onDone, and the node still has to go.
      unwatch = animator.watch((event) => {
        if ((event.type === 'cancel' || event.type === 'interrupt') && event.animation.id === handle.id) remove();
      });
    },
  } as A;
}
