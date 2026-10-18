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
 * setTimeScale reach the current child and each later one; cancel stops the
 * in-flight child and prevents future iterations. Played backward, it starts each pass before
 * the one in flight at that pass's end, and ends at the start of pass 0.
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
  let canceled = false;
  let current: AnimationHandle | null = null;

  const supervisor = createSupervisor({ kind: 'loop', cancelKey: opts.cancelKey, label: opts.label });
  supervisor.setOnCancel(() => {
    // External cancel path (animator.cancel/cancelKey or handle.cancel).
    // Mark canceled so `next` short-circuits; tear down the current child.
    canceled = true;
    current?.cancel();
    current = null;
  });

  const applyRate = (paused: boolean, timeScale: number): void => {
    if (!current) return;
    if (paused) current.pause();
    else current.resume();
    current.setTimeScale(timeScale);
  };
  supervisor.setOnRate(applyRate);

  // Started at its end inside a loop run back, it starts its last pass at that pass's end.
  const fromEnd = supervisor.atEnd && max < Infinity;
  /** The pass in flight. */
  let pass = fromEnd ? max : -1;
  let first = true;

  const next = (): void => {
    if (canceled) return;
    // Played backward, it starts each pass before at its end, and ends at the start of pass 0.
    const back = first ? fromEnd : supervisor.rate() < 0;
    first = false;
    const i = back ? pass - 1 : pass + 1;
    if (i < 0 || i >= max) {
      current = null;
      // Natural completion: deregister the supervisor so isActive() goes
      // false. `canceled` makes a late `next` a no-op.
      canceled = true;
      supervisor.finish();
      opts.onDone?.();
      return;
    }
    pass = i;
    current = supervisor.starting(back, () => factory(i, next));
    if (supervisor.isPaused() || supervisor.timeScale() !== 1) {
      applyRate(supervisor.isPaused(), supervisor.timeScale());
    }
  };

  next();

  return {
    id: supervisor.id,
    cancel: () => supervisor.cancel(),
    pause: () => supervisor.pause(),
    resume: () => supervisor.resume(),
    setTimeScale: (s) => supervisor.setTimeScale(s),
    timeScale: () => supervisor.timeScale(),
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
    (o) => createSupervisor({ ...o, kind: 'tweenLoop' }),
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
    { count: opts.count, onDone: opts.onDone, cancelKey: opts.cancelKey, label: opts.label },
  );
}
