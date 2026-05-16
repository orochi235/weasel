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
 */
export function createLoop(
  animator: Animator,
  factory: LoopFactory,
  opts: LoopOptions = {},
): AnimationHandle {
  // `animator` is intentionally unused at runtime — kept in the signature
  // so the loop is bindable to a specific animator instance for symmetry
  // with createStagger / future composition primitives.
  void animator;
  const max = opts.count ?? Infinity;
  let iteration = 0;
  let cancelled = false;
  let current: AnimationHandle | null = null;
  let id = -1;

  const next = (): void => {
    if (cancelled) return;
    if (iteration >= max) {
      current = null;
      opts.onDone?.();
      return;
    }
    const i = iteration++;
    current = factory(i, next);
    if (id === -1) id = current.id;
  };

  next();

  return {
    get id() {
      return id;
    },
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      current?.cancel();
      current = null;
    },
    pause: () => {
      current?.pause();
    },
    resume: () => {
      current?.resume();
    },
    setTimeScale: (s) => {
      current?.setTimeScale(s);
    },
    isPaused: () => current?.isPaused() ?? false,
  } as AnimationHandle;
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
  opts: TweenLoopOptions<T>,
): AnimationHandle {
  const direction = opts.direction ?? 'restart';
  return createLoop(
    animator,
    (i, next) => {
      let from = opts.from;
      let to = opts.to;
      if (direction === 'reverse') {
        from = opts.to;
        to = opts.from;
      } else if (direction === 'alternate' && i % 2 === 1) {
        from = opts.to;
        to = opts.from;
      }
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
    { count: opts.count, cancelKey: opts.cancelKey, onDone: opts.onDone },
  );
}
