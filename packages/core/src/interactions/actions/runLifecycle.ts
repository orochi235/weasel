/**
 * The lifecycle the ongoing transform actions (`move`, `resize`, `rotate`)
 * share: what their committed batch is called in history, whether it is
 * recorded at all, and the callbacks fired as the gesture opens and closes.
 *
 * Move and rotate read it from their binding's params; resize reads it from
 * the `resizePolicy` dep, where the rest of its options already live.
 */
import type { Op } from 'core/ops/types';
import { SceneArrivalRefused } from 'core/scene/arrivals';
import type { Scene } from 'core/scene/types';
import type { BehaviorEnd } from 'interactions/gestures/types';
import type { NodeId, PoseHold } from 'core/scene/types';
import type { TransformFinisher } from './transformFinish';

/** The lifecycle options, as a binding's params or the resize policy carry
 *  them. */
export interface RunLifecycleOptions {
  /** History label for the committed batch. Unset, the batch takes its first
   *  op's label (a layout drop or a behavior names its own), else the
   *  action's. */
  label?: string;
  /** Commit through `scene.untracked`: the edit lands, but no undo entry
   *  records it and the consumer `applyOps` hook is bypassed. Unset, any
   *  behavior's `defaultTransient: true` turns it on. */
  transient?: boolean;
  /** Fired once the gesture starts changing poses, with the ids it moves. */
  onRunStart?(ids: string[]): void;
  /** Fired once per `onRunStart`: `true` when the gesture wrote to the
   *  document, `false` on cancel, abort, or a release with nothing to write. */
  onRunEnd?(committed: boolean): void;
}

/** The params entries for {@link RunLifecycleOptions}, with the unset
 *  keys left out. */
export function runLifecycleParams(o: RunLifecycleOptions): RunLifecycleOptions {
  const out: RunLifecycleOptions = {};
  if (o.label !== undefined) out.label = o.label;
  if (o.transient !== undefined) out.transient = o.transient;
  if (o.onRunStart) out.onRunStart = o.onRunStart;
  if (o.onRunEnd) out.onRunEnd = o.onRunEnd;
  return out;
}

/** A gesture's resolved lifecycle. `start` and `end` fire their callbacks at
 *  most once each, and `end` only after `start`. */
export interface RunLifecycle {
  /** The label ops built by the action itself carry. */
  readonly label: string;
  /** The history label for committing `ops`. */
  labelFor(ops: readonly Op[]): string;
  readonly transient: boolean;
  start(ids: readonly string[]): void;
  end(committed: boolean): void;
}

/** The lifecycle a gesture runs under, read from its binding params: its history label, whether it commits
 *  transient, and its start and end callbacks. `defaultLabel` names it when the params do not, and any behavior
 *  defaulting to transient makes it transient. */
export function readRunLifecycle(
  source: RunLifecycleOptions | Record<string, unknown> | undefined,
  defaultLabel: string,
  behaviors: readonly { defaultTransient?: boolean }[] = [],
): RunLifecycle {
  const o = (source ?? {}) as RunLifecycleOptions;
  let started = false;
  let ended = false;
  return {
    label: o.label ?? defaultLabel,
    labelFor: (ops) => o.label ?? ops[0]?.label ?? defaultLabel,
    transient: o.transient ?? behaviors.some((b) => b.defaultTransient === true),
    start(ids) {
      if (started) return;
      started = true;
      o.onRunStart?.([...ids]);
    },
    end(committed) {
      if (!started || ended) return;
      ended = true;
      o.onRunEnd?.(committed);
    },
  };
}

/** Commit a gesture's ops, finished by `target.finish` when it has one:
 *  untracked when transient, else through the
 *  consumer `applyOps` hook when one is wired, else into the scene's history.
 *  Returns whether the commit landed: false when a container refused what
 *  the ops brought it, which the scene reverts. A consumer's `applyOps` may
 *  keep the document elsewhere, so it is taken at its word. */
export function commitRunOps(
  target: {
    scene: Scene<unknown, string, unknown>;
    applyOps?: (ops: Op[], label: string) => void;
    adapter: unknown;
    finish?: TransformFinisher;
  },
  lifecycle: RunLifecycle,
  given: Op[],
): boolean {
  const ops = target.finish ? target.finish(given, lifecycle.labelFor(given)) : given;
  if (!ops) return false;
  if (lifecycle.transient) {
    try {
      target.scene.untracked(() => {
        for (const op of ops) op.apply(target.adapter);
      });
    } catch (err) {
      // `untracked` lets a refused arrival out; `applyBatch` swallows it.
      if (!(err instanceof SceneArrivalRefused)) throw err;
      return false;
    }
    return true;
  }
  const label = lifecycle.labelFor(ops);
  if (!target.applyOps) return target.scene.applyBatch(ops, label, target.adapter);
  target.applyOps(ops, label);
  return true;
}

/** The trailing argument of {@link reduceBehaviorEnd}: what `TEnd` adds to
 *  `BehaviorEnd`, required exactly when it adds something. */
export type OwnEndFields<TEnd extends BehaviorEnd> = keyof Omit<TEnd, keyof BehaviorEnd> extends never
  ? [own?: Omit<TEnd, keyof BehaviorEnd>]
  : [own: Omit<TEnd, keyof BehaviorEnd>];

/** Runs every behavior's `onEnd` in order; the first that answers decides the
 *  commit and later answers are ignored. `null` aborts, `Op[]` claims it (an
 *  empty array included), and `undefined` means every behavior deferred to the
 *  action's own commit. An action whose behaviors take more than a plain
 *  `BehaviorEnd` passes the rest as `own`; each `onEnd` gets it beside
 *  `answered`. One that throws does not stop the rest, which are told the
 *  commit is decided; its error is rethrown after, so nothing commits. */
export function reduceBehaviorEnd<TCtx, TEnd extends BehaviorEnd = BehaviorEnd>(
  behaviors: readonly { onEnd?(ctx: TCtx, end: TEnd): Op[] | null | void }[],
  ctx: TCtx,
  ...[own]: OwnEndFields<TEnd>
): Op[] | null | undefined {
  let answer: Op[] | null | undefined;
  let threw = false;
  runEvery(behaviors, (b) => {
    try {
      const r = b.onEnd?.(ctx, { ...own, answered: threw || answer !== undefined } as TEnd);
      if (answer === undefined && r !== undefined) answer = r;
    } catch (err) {
      threw = true;
      throw err;
    }
  });
  return answer;
}

/** Runs `step` for every item, a throwing one included, then rethrows the
 *  first error. For steps that each release something of their own. */
function runEvery<T>(items: readonly T[], step: (item: T) => void): void {
  const errors: unknown[] = [];
  for (const item of items) {
    try {
      step(item);
    } catch (err) {
      errors.push(err);
    }
  }
  if (errors.length > 0) throw errors[0];
}

/** Runs every behavior's `onCancel`, for a gesture closing without a commit.
 *  One that throws does not stop the rest; its error is rethrown after. */
export function runBehaviorCancel<TCtx>(
  behaviors: readonly { onCancel?(ctx: TCtx): void }[],
  ctx: TCtx,
): void {
  runEvery(behaviors, (b) => b.onCancel?.(ctx));
}

/** Runs every behavior's `onSettled`, once the gesture's commit has landed or
 *  its cancel has run. One that throws does not stop the rest; its error is
 *  rethrown after. */
export function runBehaviorSettled<TCtx>(
  behaviors: readonly { onSettled?(ctx: TCtx, committed: boolean): void }[],
  ctx: TCtx,
  committed: boolean,
): void {
  runEvery(behaviors, (b) => b.onSettled?.(ctx, committed));
}

/** What {@link closeRun} closes. */
export interface ClosingRun<TCtx> {
  hold: PoseHold<unknown>;
  /** The action's own buffer of this frame's poses, emptied at the close. */
  previews: Map<NodeId, unknown>;
  behaviors: readonly { onSettled?(ctx: TCtx, committed: boolean): void }[];
  ctx: TCtx;
  lifecycle: RunLifecycle;
}

/**
 * The close a transform action runs from its `finally`, commit or cancel:
 * drop the preview overrides, tell the behaviors, then fire `onRunEnd`,
 * which fires even when a behavior's `onSettled` throws; the first error is
 * rethrown.
 */
export function closeRun<TCtx>(gesture: ClosingRun<TCtx>, committed: boolean): void {
  gesture.hold.drop();
  gesture.previews.clear();
  runEvery([
    () => runBehaviorSettled(gesture.behaviors, gesture.ctx, committed),
    () => gesture.lifecycle.end(committed),
  ], (step) => step());
}
