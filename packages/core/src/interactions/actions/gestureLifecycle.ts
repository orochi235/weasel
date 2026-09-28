/**
 * The lifecycle the ongoing transform actions (`move`, `resize`, `rotate`)
 * share: what their committed batch is called in history, whether it is
 * recorded at all, and the callbacks fired as the gesture opens and closes.
 *
 * Move and rotate read it from their binding's params; resize reads it from
 * the `resizePolicy` dep, where the rest of its options already live.
 */
import type { Op } from 'core/ops/types';
import type { Scene } from 'core/scene/types';

/** The lifecycle options, as a binding's params or the resize policy carry
 *  them. */
export interface GestureLifecycleOptions {
  /** History label for the committed batch. Unset, the batch takes its first
   *  op's label (a layout drop or a behavior names its own), else the
   *  action's. */
  label?: string;
  /** Commit through `scene.untracked`: the edit lands, but no undo entry
   *  records it and the consumer `applyOps` hook is bypassed. Unset, any
   *  behavior's `defaultTransient: true` turns it on. */
  transient?: boolean;
  /** Fired once the gesture starts changing poses, with the ids it moves. */
  onGestureStart?(ids: string[]): void;
  /** Fired once per `onGestureStart`: `true` when the gesture wrote to the
   *  document, `false` on cancel, abort, or a release with nothing to write. */
  onGestureEnd?(committed: boolean): void;
}

/** The params entries for {@link GestureLifecycleOptions}, with the unset
 *  keys left out. */
export function gestureLifecycleParams(o: GestureLifecycleOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.label !== undefined) out.label = o.label;
  if (o.transient !== undefined) out.transient = o.transient;
  if (o.onGestureStart) out.onGestureStart = o.onGestureStart;
  if (o.onGestureEnd) out.onGestureEnd = o.onGestureEnd;
  return out;
}

/** A gesture's resolved lifecycle. `start` and `end` fire their callbacks at
 *  most once each, and `end` only after `start`. */
export interface GestureLifecycle {
  /** The label ops built by the action itself carry. */
  readonly label: string;
  /** The history label for committing `ops`. */
  labelFor(ops: readonly Op[]): string;
  readonly transient: boolean;
  start(ids: readonly string[]): void;
  end(committed: boolean): void;
}

export function readGestureLifecycle(
  source: GestureLifecycleOptions | Record<string, unknown> | undefined,
  defaultLabel: string,
  behaviors: readonly { defaultTransient?: boolean }[] = [],
): GestureLifecycle {
  const o = (source ?? {}) as GestureLifecycleOptions;
  let started = false;
  let ended = false;
  return {
    label: o.label ?? defaultLabel,
    labelFor: (ops) => o.label ?? ops[0]?.label ?? defaultLabel,
    transient: o.transient ?? behaviors.some((b) => b.defaultTransient === true),
    start(ids) {
      if (started) return;
      started = true;
      o.onGestureStart?.([...ids]);
    },
    end(committed) {
      if (!started || ended) return;
      ended = true;
      o.onGestureEnd?.(committed);
    },
  };
}

/** Commit a gesture's ops: untracked when transient, else through the
 *  consumer `applyOps` hook when one is wired, else into the scene's history. */
export function commitGestureOps(
  target: {
    scene: Scene<unknown, string, unknown>;
    applyOps?: (ops: Op[], label: string) => void;
    adapter: unknown;
  },
  lifecycle: GestureLifecycle,
  ops: Op[],
): void {
  if (lifecycle.transient) {
    target.scene.untracked(() => {
      for (const op of ops) op.apply(target.adapter);
    });
    return;
  }
  const label = lifecycle.labelFor(ops);
  if (target.applyOps) target.applyOps(ops, label);
  else target.scene.applyBatch(ops, label, target.adapter);
}

/** Runs each behavior's `onEnd` in order; the first that answers decides the
 *  commit. `null` aborts, `Op[]` claims it (an empty array included), and
 *  `undefined` means every behavior deferred to the action's own commit. */
export function reduceBehaviorEnd<TCtx>(
  behaviors: readonly { onEnd?(ctx: TCtx): Op[] | null | void }[],
  ctx: TCtx,
): Op[] | null | undefined {
  for (const b of behaviors) {
    const r = b.onEnd?.(ctx);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** Runs every behavior's `onCancel`, for a gesture closing without a commit. */
export function runBehaviorCancel<TCtx>(
  behaviors: readonly { onCancel?(ctx: TCtx): void }[],
  ctx: TCtx,
): void {
  for (const b of behaviors) b.onCancel?.(ctx);
}
