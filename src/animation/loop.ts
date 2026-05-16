import type {
  AnimationHandle,
  Animator,
  LoopFactory,
  LoopOptions,
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
