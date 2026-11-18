import type { NodeId, PoseDescriptor, Scene } from '@weasel-js/core';
import type { Animator, EasingFn } from '@weasel-js/animator';
import { transitionCancelKey } from './cancelKey';
import { createTransitionHandle, type StageSettings } from './transitionHandle';
import { createTransitionProgress } from './transitionProgress';
import { createStageRemoval } from './transitionRemoval';
import { createItemRuns } from './transitionRuns';
import { customTweenJob, poseTweenJob, type TweenJob } from './transitionTweens';
import type { D3Transition } from './types';

interface TransitionCtx<TData, TPose> {
  scene: Scene<unknown, string, TPose>;
  animator: Animator;
  geometry: PoseDescriptor<TPose>;
  ids: readonly NodeId[];
  data: readonly TData[];
  priorPoses: ReadonlyMap<NodeId, TPose>;
  /** `scene.incarnation` of each id when the selection was made: the nodes
   *  this transition belongs to, as opposed to later ones reusing an id. */
  incarnations: ReadonlyMap<NodeId, number | undefined>;
  name: string;
}

/** One transition in a chain, as the transition chained after it sees it. */
interface Stage {
  /** The first transition in this one's chain. */
  root: Stage;
  schedule(deferReady?: boolean): void;
  /** Run `fn` once item `i` has finished this transition. Never runs if the
   *  transition is interrupted first. */
  whenItemDone(i: number, fn: () => void, defer?: boolean): void;
  interrupt(): void;
  /** Stop item `i` in this transition and every one chained after it, as if
   *  it had finished without running what waits on it; `interrupted`, as an interrupt. */
  cancelItem(i: number, interrupted?: boolean): void;
}

/**
 * A transition is *lazy*: tweens don't spawn until `.end()` is called on it or
 * on a transition chained to it. The first transition in a chain tweens each
 * node from `priorPoses[id]` → the joined pose (or its `.pose()` target); a
 * chained one tweens from wherever the previous one left the node, and only
 * when it has a `.pose()`. {@link transitionCancelKey} names its tweens.
 */
export function createTransition<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
): D3Transition<TData, TPose> {
  return makeStage(ctx, null, { duration: 250, easing: undefined }).handle;
}

/**
 * The first transition of a chain heads by default for the post-join pose: record it, then
 * write every from-pose before any tween spawns, or non-delayed tweens flash one frame of the
 * joined pose and delayed ones hold it for the whole delay. Costs one extra setPose per node in
 * the undo log.
 */
function seedFromPoses<TPose>(
  scene: Scene<unknown, string, TPose>,
  ids: readonly NodeId[],
  priorPoses: ReadonlyMap<NodeId, TPose>,
  present: (i: number) => boolean,
): Map<NodeId, TPose> {
  const joinedPoses = new Map<NodeId, TPose>();
  ids.forEach((id, i) => {
    if (present(i)) joinedPoses.set(id, scene.get(id)!.pose);
  });
  ids.forEach((id, i) => {
    const from = priorPoses.get(id);
    if (from !== undefined && present(i)) scene.setPose(id, from);
  });
  return joinedPoses;
}

/**
 * Where item `i` tweens its pose. A chained transition goes from where the node stands to its
 * `.pose()`, if any; the first of a chain from the item's prior pose to its `.pose()`, or to the
 * joined pose without one, and is null when the item has no prior or joined pose.
 */
function itemEnds<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
  i: number,
  poseFn: ((d: TData, i: number) => TPose) | null,
  joinedPoses: ReadonlyMap<NodeId, TPose> | null,
): { from: TPose; to: TPose | undefined } | null {
  const id = ctx.ids[i];
  const target = poseFn ? (): TPose => poseFn(ctx.data[i], i) : null;
  if (!joinedPoses) return { from: ctx.scene.get(id)!.pose, to: target?.() };
  const from = ctx.priorPoses.get(id);
  const joined = joinedPoses.get(id);
  if (from === undefined || joined === undefined) return null;
  return { from, to: target ? target() : joined };
}

/** Item `i`'s tweens: its pose, when it has somewhere to go, and every custom tween; `lost`
 *  says the node has left the scene, and stops a tween writing to it. */
function itemJobs<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
  settings: StageSettings<TData, TPose>,
  i: number,
  ends: { from: TPose; to: TPose | undefined },
  lost: () => boolean,
): TweenJob[] {
  const { scene, animator, name } = ctx;
  const id = ctx.ids[i];
  const d = ctx.data[i];
  const jobs: TweenJob[] = [];
  if (ends.to !== undefined) {
    jobs.push(poseTweenJob(animator, settings, transitionCancelKey(name, id), ends.from, ends.to, ctx.geometry.lerp!, (pose) => {
      if (!lost()) scene.setPose(id, pose);
    }));
  }
  for (const ct of settings.tweens) {
    jobs.push(customTweenJob(
      animator, settings, transitionCancelKey(name, id, ct.name), ct, ct.from(d, i), ct.to(d, i),
      (value) => { if (!lost()) ct.apply(d, id, value); },
    ));
  }
  return jobs;
}

function makeStage<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
  parent: Stage | null,
  inherited: { duration: number; easing: EasingFn | undefined },
): { handle: D3Transition<TData, TPose>; stage: Stage } {
  const { scene, ids, data, priorPoses, name } = ctx;
  const settings: StageSettings<TData, TPose> = {
    duration: inherited.duration, easing: inherited.easing, delay: null, pose: null, tweens: [], remove: false,
  };
  const progress = createTransitionProgress(ids.length);
  const children: Stage[] = [];
  let scheduled = false;
  /** Where the first transition in a chain heads by default: the post-join pose. */
  let joinedPoses = new Map<NodeId, TPose>();
  const keys = ids.map((id) => transitionCancelKey(name, id));
  const stops = ids.map((_, i) => (): void => stage.root.cancelItem(i, true));
  const runs = createItemRuns(ctx.animator, keys, stops, () => stage.root);

  const finishItem = (i: number): void => progress.finish(i, () => runs.untrack(i));

  const present = (i: number): boolean => {
    const token = scene.incarnation(ids[i]);
    return token !== undefined && token === ctx.incarnations.get(ids[i]);
  };

  /** The scene can lose a node mid-tween (an undo, any outside `remove`), or
   *  swap in another under the same id. Stop the item through the whole chain,
   *  so neither a tween nor a pending `.remove()` touches the id again. */
  const lost = (i: number): boolean => {
    if (present(i)) return false;
    stage.root.cancelItem(i);
    return true;
  };

  const runItem = (i: number): void => {
    if (progress.canceled || lost(i)) return;
    const ends = itemEnds(ctx, i, settings.pose, parent ? null : joinedPoses);
    if (!ends) return finishItem(i);

    const jobs = itemJobs(ctx, settings, i, ends, () => lost(i));
    if (jobs.length === 0) return finishItem(i);
    progress.start();
    const delayMs = settings.delay ? Math.max(0, settings.delay(data[i], i)) : 0;
    runs.launch(i, jobs, delayMs, () => progress.canceled, () => finishItem(i));
  };

  const removal = createStageRemoval(scene, ids, {
    cancelItem: (i) => stage.root.cancelItem(i),
    whenItemDone: (i, fn) => stage.whenItemDone(i, fn),
    present,
  });
  const armRemoval = (): void => {
    if (!progress.canceled) removal.arm();
  };

  const stage: Stage = {
    root: undefined as unknown as Stage,
    schedule(deferReady = false) {
      if (scheduled || progress.canceled) return;
      scheduled = true;
      if (settings.remove) armRemoval();
      if (!ctx.geometry.lerp) {
        throw new Error(
          'd3Bind.transition: its pose descriptor has no `lerp` — pass `poseDescriptor` with one in D3BindOptions',
        );
      }
      ids.forEach((_, i) => runs.track(i));
      if (parent) {
        parent.schedule();
        ids.forEach((_, i) => parent.whenItemDone(i, () => runItem(i), deferReady));
      } else {
        joinedPoses = seedFromPoses(scene, ids, priorPoses, present);
        ids.forEach((_, i) => runItem(i));
      }
      progress.settle();
      for (const child of children) child.schedule();
    },
    whenItemDone(i, fn, defer = false) {
      progress.whenDone(i, fn, defer);
    },
    interrupt() {
      progress.cancel(() => {
        ids.forEach((_, i) => runs.stop(i));
        removal.releaseAll();
      });
      for (const child of children) child.interrupt();
    },
    cancelItem(i, interrupted = false) {
      if (progress.drop(i, interrupted)) runs.stop(i);
      removal.release(ids[i]);
      for (const child of children) child.cancelItem(i, interrupted);
      progress.settle();
    },
  };
  stage.root = parent ? parent.root : stage;

  const handle = createTransitionHandle(settings, {
    on: progress.on,
    chain() {
      const next = makeStage(ctx, stage, { duration: settings.duration, easing: settings.easing });
      children.push(next.stage);
      if (progress.canceled) next.stage.interrupt();
      // Already in flight: queue behind it now, but let the caller finish
      // configuring before an item whose turn has already come runs.
      else if (scheduled && !progress.ended) next.stage.schedule(true);
      return next.handle;
    },
    interrupt: () => stage.interrupt(),
    remove() {
      if (scheduled) armRemoval();
    },
    end() {
      stage.schedule();
      return progress.end;
    },
  });
  return { handle, stage };
}
