import type { SupervisorFactory } from './supervisor';
import type {
  AnimationHandle,
  Animator,
  LoopFactory,
  LoopOptions,
  TweenLoopOptions,
} from './types';

/**
 * Loop primitive. Repeatedly invokes `factory(i, next)` to produce a child
 * animation. The factory is responsible for wiring its returned handle's
 * `onDone` to call `next` — that's how the loop advances. Pause/resume/
 * setTimeScale delegate to the current child; cancel stops the in-flight
 * child and prevents future iterations.
 *
 * The loop is registered with the animator under a supervisor entry, so
 * `animator.cancel(handle)`, `animator.cancelKey(key)`, and
 * `animator.isActive(key)` all work for it.
 */
export function createLoop(
  createSupervisor: SupervisorFactory,
  factory: LoopFactory,
  opts: LoopOptions = {},
): AnimationHandle {
  const max = opts.count ?? Infinity;
  let iteration = 0;
  let cancelled = false;
  let current: AnimationHandle | null = null;

  const supervisor = createSupervisor(opts.cancelKey);
  supervisor.setOnCancel(() => {
    // External cancel path (animator.cancel/cancelKey or handle.cancel).
    // Mark cancelled so `next` short-circuits; tear down the current child.
    cancelled = true;
    current?.cancel();
    current = null;
  });

  const next = (): void => {
    if (cancelled) return;
    if (iteration >= max) {
      current = null;
      // Natural completion: deregister the supervisor so isActive() goes
      // false. Mark cancelled first so onCancel is a no-op (no children to
      // tear down; child already finished naturally and called next).
      cancelled = true;
      supervisor.cancel();
      opts.onDone?.();
      return;
    }
    const i = iteration++;
    current = factory(i, next);
  };

  next();

  return {
    id: supervisor.id,
    cancel: () => supervisor.cancel(),
    pause: () => {
      supervisor.pause();
      current?.pause();
    },
    resume: () => {
      supervisor.resume();
      current?.resume();
    },
    setTimeScale: (s) => {
      supervisor.setTimeScale(s);
      current?.setTimeScale(s);
    },
    isPaused: () => supervisor.isPaused(),
  };
}

/**
 * Sugar over `createLoop` for the common case of looping a tween between two
 * values. `direction` controls per-iteration from/to:
 *   - `restart` (default): from→to every iteration
 *   - `reverse`: to→from every iteration
 *   - `alternate`: even iterations from→to, odd iterations to→from
 */
export function createTweenLoop<T>(
  animator: Animator,
  createSupervisor: SupervisorFactory,
  opts: TweenLoopOptions<T>,
): AnimationHandle {
  const direction = opts.direction ?? 'restart';
  return createLoop(
    createSupervisor,
    (i, next) => {
      const flipped = direction === 'reverse' || (direction === 'alternate' && i % 2 === 1);
      const from = flipped ? opts.to : opts.from;
      const to = flipped ? opts.from : opts.to;
      return animator.tween({
        from,
        to,
        ms: opts.ms,
        easing: opts.easing,
        interpolate: opts.interpolate,
        onTick: opts.onTick,
        onDone: next,
      });
    },
    { count: opts.count, onDone: opts.onDone, cancelKey: opts.cancelKey },
  );
}
