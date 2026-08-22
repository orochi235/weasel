import type {
  Animator,
  AnimationHandle,
  EasingFn,
  NodeId,
  PoseProjection,
  Scene,
} from '@weasel-js/core';
import type { D3Transition } from './types';

interface TransitionCtx<TData, TPose> {
  scene: Scene<unknown, string, TPose>;
  animator: Animator;
  geometry: PoseProjection<TPose>;
  ids: readonly NodeId[];
  data: readonly TData[];
  priorPoses: ReadonlyMap<NodeId, TPose>;
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
 * until `.end()` is called (or `await`-ed). This lets the consumer chain
 * `.duration().ease().delay()...` after `.transition()` without having
 * to declare them in advance.
 *
 * For each selected node, one pose tween is spawned from `priorPoses[id]` →
 * current scene pose. Custom `.tween()` declarations spawn one extra tween
 * per node per declaration, using the kit's animator factory-interpolator
 * slot when an `interpolate` factory is provided.
 *
 * `interrupt()` cancels via the kit's `animator.cancelKey`. The cancelKey
 * format is `d3-transition:<name>:<nodeId>` for pose tweens and
 * `d3-transition:<name>:<nodeId>:<tweenName>` for custom tweens.
 * `animator.cancelKey` matches a key exactly, so a selection-level
 * `.interrupt(name)` cannot reach the custom keys by prefix — live custom
 * keys are tracked in `LIVE_CUSTOM_KEYS` and read back by `customKeysFor`.
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
 * `animator.cancelKey`, and a cancelled tween never runs its `onDone`, so
 * leaving the keys behind would strand one entry per interrupted tween.
 */
export function takeCustomKeys(ns: string): string[] {
  const set = LIVE_CUSTOM_KEYS.get(ns);
  if (!set) return [];
  LIVE_CUSTOM_KEYS.delete(ns);
  return [...set];
}

export function createTransition<TData, TPose>(
  ctx: TransitionCtx<TData, TPose>,
): D3Transition<TData> {
  let duration = 250;
  let easing: EasingFn | undefined;
  let delayFn: ((d: TData, i: number) => number) | null = null;
  let started = false;
  const customTweens: Array<CustomTween<TData>> = [];
  const onStart: Array<() => void> = [];
  const onEnd: Array<() => void> = [];
  const onInterrupt: Array<() => void> = [];

  let pendingCount = 0;
  let cancelled = false;
  let endResolved = false;
  /** (namespace, key) pairs this transition put in `LIVE_CUSTOM_KEYS`.
   *  `handle.cancel()` does not run a tween's `onDone`, so `interrupt()`
   *  drains these itself or the keys outlive their tweens. */
  const spawnedCustom: Array<[string, string]> = [];
  let resolveEnd: (() => void) | null = null;
  const endPromise = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });
  const handles: AnimationHandle[] = [];
  const pendingDelays = new Set<ReturnType<typeof setTimeout>>();

  const settleIfDone = (): void => {
    if (pendingCount === 0 && !endResolved) {
      endResolved = true;
      if (!cancelled) onEnd.forEach((fn) => fn());
      resolveEnd?.();
    }
  };

  const ensureStarted = (): void => {
    if (started) return;
    started = true;

    const { scene, geometry, ids, data, priorPoses, name } = ctx;
    const lerp = geometry.lerp;
    if (!lerp) {
      throw new Error(
        'd3Bind.transition: provided geometry has no `lerp` — pass a PoseProjection with lerp in BindOptions',
      );
    }

    // Snapshot target poses NOW (post-join scene state) for each selected id.
    const targetPoses = new Map<NodeId, TPose>();
    for (const id of ids) {
      const node = scene.get(id);
      if (node) targetPoses.set(id, node.pose);
    }

    // Eagerly write the from-pose for each selected node BEFORE any tween
    // spawns. Without this:
    //   - Non-delayed tweens flash a single frame of the post-join pose
    //     before the animator's first tick writes from-state.
    //   - Delayed tweens show the post-join pose for the entire delay window.
    // The eager write produces one extra setPose per node in the undo log;
    // history-bypass for transition ticks is a v2 follow-up (see spec).
    for (const id of ids) {
      const from = priorPoses.get(id);
      if (from !== undefined) scene.setPose(id, from);
    }

    let anySpawned = false;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const d = data[i];
      const from = priorPoses.get(id);
      const to = targetPoses.get(id);
      if (from === undefined || to === undefined) continue;

      const delayMs = delayFn ? Math.max(0, delayFn(d, i)) : 0;

      const spawnPoseTween = (): void => {
        if (cancelled) return;
        anySpawned = true;
        const handle = ctx.animator.tween<TPose>({
          from,
          to,
          ms: duration,
          easing,
          cancelKey: `d3-transition:${name}:${id}`,
          interpolate: (a, b, t) => lerp(a, b, t),
          onTick: (pose) => {
            // setPose writes through to the scene; SceneCanvas redraws.
            scene.setPose(id, pose);
          },
          onDone: () => {
            pendingCount--;
            settleIfDone();
          },
        });
        handles.push(handle);
      };

      pendingCount++;
      if (delayMs > 0) {
        const timer = setTimeout(() => {
          pendingDelays.delete(timer);
          spawnPoseTween();
        }, delayMs);
        pendingDelays.add(timer);
      } else {
        spawnPoseTween();
      }

      // Custom tweens — spawn one per registered .tween() per node.
      for (const ct of customTweens) {
        const fromVal = ct.from(d, i);
        const toVal = ct.to(d, i);
        const ns = `d3-transition:${name}:${id}`;
        const customKey = `${ns}:${ct.name}`;
        const spawnCustom = (): void => {
          if (cancelled) return;
          anySpawned = true;
          trackCustomKey(ns, customKey);
          spawnedCustom.push([ns, customKey]);
          const handle = ctx.animator.tween({
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
            onTick: (value) => ct.apply(d, id, value),
            onDone: () => {
              untrackCustomKey(ns, customKey);
              pendingCount--;
              settleIfDone();
            },
          });
          handles.push(handle);
        };

        pendingCount++;
        if (delayMs > 0) {
          const timer = setTimeout(() => {
            pendingDelays.delete(timer);
            spawnCustom();
          }, delayMs);
          pendingDelays.add(timer);
        } else {
          spawnCustom();
        }
      }
    }

    if (anySpawned || pendingDelays.size > 0) {
      onStart.forEach((fn) => fn());
    } else {
      // Nothing to animate (empty selection, no pose deltas). Resolve immediately.
      settleIfDone();
    }
  };

  const t: D3Transition<TData> = {
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
    interrupt() {
      if (cancelled || endResolved) return;
      cancelled = true;
      for (const timer of pendingDelays) clearTimeout(timer);
      pendingDelays.clear();
      for (const h of handles) h.cancel();
      handles.length = 0;
      for (const [ns, key] of spawnedCustom) untrackCustomKey(ns, key);
      spawnedCustom.length = 0;
      onInterrupt.forEach((fn) => fn());
      // Drain pendingCount so resolveEnd fires; any in-flight onDone callbacks
      // will see endResolved=true and short-circuit.
      pendingCount = 0;
      if (!endResolved) {
        endResolved = true;
        resolveEnd?.();
      }
    },
    end() {
      ensureStarted();
      return endPromise;
    },
  };
  return t;
}
