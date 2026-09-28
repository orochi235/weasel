import type {
  Animator,
  AnimationHandle,
  EasingFn,
  NodeId,
  PoseDescriptor,
  Scene,
} from '@weasel-js/core';
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

interface CustomTween<TData> {
  name: string;
  from: (d: TData, i: number) => unknown;
  to: (d: TData, i: number) => unknown;
  interpolate?: (from: unknown, to: unknown) => (t: number) => unknown;
  apply: (d: TData, id: NodeId, value: unknown) => void;
}

/**
 * Build a transition handle. The transition is *lazy*: tweens don't spawn
 * until `.end()` is called on it or on a transition chained to it. This lets
 * the consumer chain `.duration().ease().delay()...` after `.transition()`
 * without having to declare them in advance.
 *
 * For each selected node, the first transition in a chain spawns one pose tween
 * from `priorPoses[id]` → the joined pose (or its `.pose()` target); a chained
 * transition tweens from wherever the previous one left the node, and only
 * when it has a `.pose()`. Custom `.tween()` declarations spawn one extra tween
 * per node per declaration, using the kit's animator factory-interpolator
 * slot when an `interpolate` factory is provided.
 *
 * `interrupt()` cancels via the kit's `animator.cancelKey`. The cancelKey
 * format is `d3-transition:<name>:<nodeId>` for pose tweens and
 * `d3-transition:<name>:<nodeId>:<tweenName>` for custom tweens.
 * `animator.cancelKey` matches a key exactly, so a selection-level
 * `.interrupt(name)` cannot reach the custom keys by prefix — live custom
 * keys are tracked in `LIVE_CUSTOM_KEYS` and read back by `takeCustomKeys`.
 */

/** Live custom-tween cancelKeys, grouped by their pose-tween namespace
 *  (`d3-transition:<name>:<nodeId>`). Populated on spawn and drained on
 *  completion or cancel, so a selection-level interrupt can find the keys a
 *  prefix match would otherwise have given it. */
const LIVE_CUSTOM_KEYS = new Map<string, Set<string>>();

function trackCustomKey(ns: string, key: string): void {
  const set = LIVE_CUSTOM_KEYS.get(ns) ?? new Set<string>();
  set.add(key);
  LIVE_CUSTOM_KEYS.set(ns, set);
}

function untrackCustomKey(ns: string, key: string): void {
  const set = LIVE_CUSTOM_KEYS.get(ns);
  if (!set) return;
  set.delete(key);
  if (set.size === 0) LIVE_CUSTOM_KEYS.delete(ns);
}

/**
 * @internal Take the live custom-tween cancelKeys under `ns`, clearing them.
 *
 * Draining is what keeps the table bounded: the caller's next move is
 * `animator.cancelKey`, and a canceled tween never runs its `onDone`, so
 * leaving the keys behind would strand one entry per interrupted tween.
 */
export function takeCustomKeys(ns: string): string[] {
  const set = LIVE_CUSTOM_KEYS.get(ns);
  if (!set) return [];
  LIVE_CUSTOM_KEYS.delete(ns);
  return [...set];
}

/** Per scene, the nodes a `.remove()` transition will delete when it ends,
 *  each with the cancel that keeps it. Keyed weakly so a dropped scene takes
 *  its entries with it. */
const PENDING_REMOVALS = new WeakMap<object, Map<NodeId, Set<() => void>>>();

function pendingFor(scene: object): Map<NodeId, Set<() => void>> {
  let map = PENDING_REMOVALS.get(scene);
  if (!map) {
    map = new Map();
    PENDING_REMOVALS.set(scene, map);
  }
  return map;
}

function unregisterRemoval(scene: object, id: NodeId, cancel: () => void): void {
  const map = PENDING_REMOVALS.get(scene);
  const set = map?.get(id);
  if (!map || !set) return;
  set.delete(cancel);
  if (set.size === 0) map.delete(id);
}

/**
 * @internal Stop every transition chain that would remove `id` when it ends,
 * for that node only, so the node stays in the scene. The join calls this for
 * a key that re-enters while its node is still exiting (d3's rebinding of an
 * exiting element).
 */
export function cancelPendingRemoval(scene: object, id: NodeId): void {
  const set = PENDING_REMOVALS.get(scene)?.get(id);
  if (!set) return;
  for (const cancel of [...set]) cancel();
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
   *  it had finished without running what waits on it. */
  cancelItem(i: number): void;
}

export function createTransition<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
): D3Transition<TData, TPose> {
  return makeStage(ctx, null, { duration: 250, easing: undefined }).handle;
}

function makeStage<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
  parent: Stage | null,
  inherited: { duration: number; easing: EasingFn | undefined },
): { handle: D3Transition<TData, TPose>; stage: Stage } {
  const { scene, ids, data, priorPoses, name } = ctx;
  let duration = inherited.duration;
  let easing = inherited.easing;
  let delayFn: ((d: TData, i: number) => number) | null = null;
  let poseFn: ((d: TData, i: number) => TPose) | null = null;
  const customTweens: Array<CustomTween<TData>> = [];
  const onStart: Array<() => void> = [];
  const onEnd: Array<() => void> = [];
  const onInterrupt: Array<() => void> = [];
  const children: Stage[] = [];
  let removeOnEnd = false;
  let removalArmed = false;
  const removalCancels: Array<[NodeId, () => void]> = [];

  let scheduled = false;
  let startFired = false;
  let canceled = false;
  let endResolved = false;
  const itemDone = ids.map(() => false);
  const itemWaiters = new Map<number, Array<() => void>>();
  let itemsLeft = ids.length;
  /** Where the first transition in a chain heads by default: the post-join pose. */
  const joinedPoses = new Map<NodeId, TPose>();
  /** (namespace, key) pairs this transition put in `LIVE_CUSTOM_KEYS`, per
   *  item. `handle.cancel()` does not run a tween's `onDone`, so a cancel
   *  drains these itself or the keys outlive their tweens. */
  const spawnedCustom = new Map<number, Array<[string, string]>>();
  let resolveEnd: (() => void) | null = null;
  const endPromise = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });
  const handles = new Map<number, AnimationHandle[]>();
  const pendingDelays = new Map<number, ReturnType<typeof setTimeout>>();

  const stopItem = (i: number): void => {
    const timer = pendingDelays.get(i);
    if (timer !== undefined) clearTimeout(timer);
    pendingDelays.delete(i);
    for (const h of handles.get(i) ?? []) h.cancel();
    handles.delete(i);
    for (const [ns, key] of spawnedCustom.get(i) ?? []) untrackCustomKey(ns, key);
    spawnedCustom.delete(i);
  };

  const pushTo = <V>(map: Map<number, V[]>, i: number, v: V): void => {
    const list = map.get(i) ?? [];
    list.push(v);
    map.set(i, list);
  };

  const settleIfDone = (): void => {
    if (itemsLeft === 0 && !endResolved) {
      endResolved = true;
      if (!canceled) onEnd.forEach((fn) => fn());
      resolveEnd?.();
    }
  };

  const finishItem = (i: number): void => {
    if (canceled || itemDone[i]) return;
    itemDone[i] = true;
    itemsLeft--;
    const waiters = itemWaiters.get(i);
    itemWaiters.delete(i);
    waiters?.forEach((fn) => fn());
    settleIfDone();
  };

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
    if (canceled || lost(i)) return;
    const id = ids[i];
    const d = data[i];
    let from: TPose | undefined;
    let to: TPose | undefined;
    if (parent) {
      from = scene.get(id)!.pose;
      to = poseFn ? poseFn(d, i) : undefined;
    } else {
      from = priorPoses.get(id);
      const joined = joinedPoses.get(id);
      if (from === undefined || joined === undefined) return finishItem(i);
      to = poseFn ? poseFn(d, i) : joined;
    }

    const jobs: Array<(done: () => void) => void> = [];
    const ns = `d3-transition:${name}:${id}`;
    const lerp = ctx.geometry.lerp!;
    if (to !== undefined) {
      const poseFrom = from;
      const poseTo = to;
      jobs.push((done) => {
        pushTo(
          handles,
          i,
          ctx.animator.tween<TPose>({
            from: poseFrom,
            to: poseTo,
            ms: duration,
            easing,
            cancelKey: ns,
            interpolate: (a, b, t) => lerp(a, b, t),
            onTick: (pose) => {
              if (!lost(i)) scene.setPose(id, pose);
            },
            onDone: done,
          }),
        );
      });
    }
    for (const ct of customTweens) {
      const fromVal = ct.from(d, i);
      const toVal = ct.to(d, i);
      const customKey = `${ns}:${ct.name}`;
      jobs.push((done) => {
        trackCustomKey(ns, customKey);
        pushTo(spawnedCustom, i, [ns, customKey] as [string, string]);
        pushTo(
          handles,
          i,
          ctx.animator.tween({
            from: fromVal,
            to: toVal,
            ms: duration,
            easing,
            cancelKey: customKey,
            interpolator: ct.interpolate,
            interpolate: ct.interpolate
              ? undefined
              : ((a, b, t) => {
                  // Fallback per-tick interpolator for numeric values when no factory is given.
                  if (typeof a === 'number' && typeof b === 'number') {
                    return (a as number) + ((b as number) - (a as number)) * t;
                  }
                  throw new Error(
                    `d3Bind.transition.tween("${ct.name}"): non-numeric value without an interpolate factory`,
                  );
                }),
            onTick: (value) => {
              if (!lost(i)) ct.apply(d, id, value);
            },
            onDone: () => {
              untrackCustomKey(ns, customKey);
              done();
            },
          }),
        );
      });
    }

    if (jobs.length === 0) return finishItem(i);
    if (!startFired) {
      startFired = true;
      onStart.forEach((fn) => fn());
    }
    let jobsLeft = jobs.length;
    const jobDone = (): void => {
      if (--jobsLeft === 0) finishItem(i);
    };
    const spawn = (): void => {
      if (canceled) return;
      for (const job of jobs) job(jobDone);
    };
    const delayMs = delayFn ? Math.max(0, delayFn(d, i)) : 0;
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        pendingDelays.delete(i);
        spawn();
      }, delayMs);
      pendingDelays.set(i, timer);
    } else {
      spawn();
    }
  };

  const armRemoval = (): void => {
    if (removalArmed || canceled) return;
    removalArmed = true;
    ids.forEach((id, i) => {
      const cancel = (): void => stage.root.cancelItem(i);
      removalCancels.push([id, cancel]);
      const set = pendingFor(scene).get(id) ?? new Set<() => void>();
      set.add(cancel);
      pendingFor(scene).set(id, set);
      stage.whenItemDone(i, () => {
        unregisterRemoval(scene, id, cancel);
        if (present(i)) scene.remove(id);
      });
    });
  };

  const stage: Stage = {
    root: undefined as unknown as Stage,
    schedule(deferReady = false) {
      if (scheduled || canceled) return;
      scheduled = true;
      if (removeOnEnd) armRemoval();
      if (!ctx.geometry.lerp) {
        throw new Error(
          'd3Bind.transition: provided geometry has no `lerp` — pass a PoseDescriptor with lerp in BindOptions',
        );
      }
      if (parent) {
        parent.schedule();
        ids.forEach((_, i) => parent.whenItemDone(i, () => runItem(i), deferReady));
      } else {
        ids.forEach((id, i) => {
          if (present(i)) joinedPoses.set(id, scene.get(id)!.pose);
        });
        // Write every from-pose before any tween spawns, or non-delayed tweens
        // flash one frame of the joined pose and delayed ones hold it for the
        // whole delay. Costs one extra setPose per node in the undo log.
        ids.forEach((id, i) => {
          const from = priorPoses.get(id);
          if (from !== undefined && present(i)) scene.setPose(id, from);
        });
        ids.forEach((_, i) => runItem(i));
      }
      settleIfDone();
      for (const child of children) child.schedule();
    },
    whenItemDone(i, fn, defer = false) {
      if (!itemDone[i]) {
        const list = itemWaiters.get(i) ?? [];
        list.push(fn);
        itemWaiters.set(i, list);
      } else if (defer) {
        queueMicrotask(fn);
      } else {
        fn();
      }
    },
    interrupt() {
      if (!canceled && !endResolved) {
        canceled = true;
        ids.forEach((_, i) => stopItem(i));
        itemWaiters.clear();
        for (const [id, cancel] of removalCancels) unregisterRemoval(scene, id, cancel);
        removalCancels.length = 0;
        onInterrupt.forEach((fn) => fn());
        endResolved = true;
        resolveEnd?.();
      }
      for (const child of children) child.interrupt();
    },
    cancelItem(i) {
      if (!canceled && !itemDone[i]) {
        itemDone[i] = true;
        itemsLeft--;
        itemWaiters.delete(i);
        stopItem(i);
      }
      const cancel = removalCancels.find(([id]) => id === ids[i])?.[1];
      if (cancel) unregisterRemoval(scene, ids[i], cancel);
      for (const child of children) child.cancelItem(i);
      settleIfDone();
    },
  };
  stage.root = parent ? parent.root : stage;

  const t: D3Transition<TData, TPose> = {
    duration(ms) {
      duration = ms;
      return t;
    },
    ease(fn) {
      easing = fn;
      return t;
    },
    delay(arg) {
      delayFn = typeof arg === 'function' ? arg : () => arg;
      return t;
    },
    pose(fn) {
      poseFn = fn;
      return t;
    },
    tween(opts) {
      customTweens.push({
        name: opts.name,
        from: opts.from as (d: TData, i: number) => unknown,
        to: opts.to as (d: TData, i: number) => unknown,
        interpolate: opts.interpolate as
          | ((from: unknown, to: unknown) => (t: number) => unknown)
          | undefined,
        apply: opts.apply as (d: TData, id: NodeId, value: unknown) => void,
      });
      return t;
    },
    on(event, fn) {
      if (event === 'start') onStart.push(fn);
      else if (event === 'end') onEnd.push(fn);
      else if (event === 'interrupt') onInterrupt.push(fn);
      return t;
    },
    transition() {
      const next = makeStage(ctx, stage, { duration, easing });
      children.push(next.stage);
      if (canceled) next.stage.interrupt();
      // Already in flight: queue behind it now, but let the caller finish
      // configuring before an item whose turn has already come runs.
      else if (scheduled && !endResolved) next.stage.schedule(true);
      return next.handle;
    },
    interrupt() {
      stage.interrupt();
    },
    remove() {
      removeOnEnd = true;
      if (scheduled) armRemoval();
      return t;
    },
    end() {
      stage.schedule();
      return endPromise;
    },
  };
  return { handle: t, stage };
}
