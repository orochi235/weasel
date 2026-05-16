import type {
  AnimationHandle,
  Animator,
  StaggerBuilder,
  StaggerDelay,
  StaggerFactory,
} from './types';

/** Resolved timer-pair, supplied by `useAnimator` so stagger picks up the
 *  same test-time injection points the rAF loop uses. */
export interface StaggerTimers {
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

/**
 * Composite handle returned by `createStagger`. Owns a list of in-flight
 * child handles and a list of pending timer handles; cancel cancels both.
 * Pause/resume/setTimeScale propagate to in-flight children. Pending timers
 * are not pausable on the host scheduler — calling pause does not delay
 * their firing (documented limitation, v1).
 *
 * NOTE: not registered in the animator's id table; cancel via
 * `handle.cancel()` directly. `animator.cancel(handle)` / `cancelKey` are
 * no-ops for composite handles.
 */
class CompositeHandle implements AnimationHandle {
  id = -1;
  private cancelled = false;
  private paused_ = false;
  private timeScale_ = 1;
  private children: AnimationHandle[] = [];
  private pending: unknown[] = [];

  constructor(private timers: StaggerTimers) {}

  addChild(h: AnimationHandle): void {
    if (this.cancelled) {
      h.cancel();
      return;
    }
    this.children.push(h);
    if (this.paused_) h.pause();
    if (this.timeScale_ !== 1) h.setTimeScale(this.timeScale_);
  }

  schedule(delayMs: number, fire: () => void): void {
    if (this.cancelled) return;
    const wrapped = (): void => {
      if (this.cancelled) return;
      // Drop the timer from `pending` once it fires so `cancel` doesn't
      // try to clear an already-elapsed handle. Search by reference; we
      // don't know the timer handle until setTimer returns, so capture
      // through the closure below.
      const idx = this.pending.indexOf(timerHandle);
      if (idx >= 0) this.pending.splice(idx, 1);
      fire();
    };
    const timerHandle = this.timers.setTimer(wrapped, delayMs);
    this.pending.push(timerHandle);
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const t of this.pending) this.timers.clearTimer(t);
    this.pending = [];
    for (const c of this.children) c.cancel();
    this.children = [];
  }

  pause(): void {
    this.paused_ = true;
    for (const c of this.children) c.pause();
  }

  resume(): void {
    this.paused_ = false;
    for (const c of this.children) c.resume();
  }

  setTimeScale(s: number): void {
    this.timeScale_ = s;
    for (const c of this.children) c.setTimeScale(s);
  }

  isPaused(): boolean {
    return this.paused_;
  }
}

function delayFor(delay: StaggerDelay, i: number): number {
  return typeof delay === 'function' ? delay(i) : delay * i;
}

/**
 * Stagger primitive. With `factory`, returns the composite handle directly.
 * Without `factory`, returns a `StaggerBuilder` whose `.each` runs the
 * stagger with a factory.
 */
export function createStagger<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
): AnimationHandle;
export function createStagger<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem>;
export function createStagger<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory?: StaggerFactory<TItem>,
): AnimationHandle | StaggerBuilder<TItem> {
  if (factory) return runStagger(timers, items, delay, factory);
  return makeBuilder(animator, timers, items, delay);
}

function runStagger<TItem>(
  timers: StaggerTimers,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
): AnimationHandle {
  const composite = new CompositeHandle(timers);
  items.forEach((item, i) => {
    const ms = delayFor(delay, i);
    const fire = (): void => {
      composite.addChild(factory(item, i));
    };
    if (ms <= 0) fire();
    else composite.schedule(ms, fire);
  });
  return composite;
}

function makeBuilder<TItem>(
  _animator: Animator,
  timers: StaggerTimers,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  return {
    each: (factory) => runStagger(timers, items, delay, factory),
  };
}
