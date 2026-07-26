import { springPose } from './poseHelpers';
import type { Supervisor, SupervisorFactory, WatchCompletion } from './supervisor';
import type {
  AnimationHandle,
  Animator,
  StaggerBuilder,
  StaggerDelay,
  StaggerFactory,
  StaggerOptions,
  StaggerPerItem,
  StaggerSpringPoseOptions,
  StaggerTweenOptions,
} from './types';
import type { SceneAdapter } from 'core/adapters/types';

/** Resolved timer-pair + clock, supplied by `useAnimator` so stagger picks
 *  up the same test-time injection points the rAF loop uses. `now` is used
 *  by pause/resume to freeze pending timers at their remaining time. */
export interface StaggerTimers {
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
}

interface PendingEntry {
  /** Active host-scheduler timer handle, or null while paused. */
  timer: unknown | null;
  /** Absolute virtual-time at which the entry should fire. */
  resolvedAt: number;
  /** Wrapped callback (drops itself from `pending` before invoking the user fire). */
  fire: () => void;
  /** Remaining ms when paused; ignored while running. */
  remainingMs: number;
  /** True while the timer is suspended by `composite.pause()`. */
  paused: boolean;
}

/**
 * Composite handle returned by `createStagger`. Owns a list of in-flight
 * child handles and a list of pending timer entries; cancel cancels both.
 * Pause/resume/setTimeScale propagate to in-flight children; pause/resume
 * also freeze and thaw pending per-item timers, preserving each entry's
 * remaining time across the pause.
 *
 * Registered with the animator via a supervisor so animator.cancel /
 * cancelKey / isActive all work for it.
 */
class CompositeHandle implements AnimationHandle {
  readonly id: number;
  private cancelled = false;
  private paused_ = false;
  private timeScale_ = 1;
  private children: AnimationHandle[] = [];
  private pending: PendingEntry[] = [];
  private outstanding: number;
  private finished = false;

  constructor(
    private timers: StaggerTimers,
    private supervisor: Supervisor,
    totalItems: number,
  ) {
    this.id = supervisor.id;
    this.outstanding = totalItems;
    supervisor.setOnCancel(() => this.handleSupervisorCancel());
  }

  /** Invoked when the supervisor is cancelled externally (animator.cancel /
   *  cancelKey) OR via this composite's own cancel/natural-completion path. */
  private handleSupervisorCancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const p of this.pending) {
      if (p.timer != null) this.timers.clearTimer(p.timer);
    }
    this.pending = [];
    // Snapshot children first: child.cancel() may synchronously invoke our
    // own noteChildDone path via the animator's completion listener, which
    // would mutate this.children mid-iteration.
    const kids = this.children.slice();
    this.children = [];
    for (const c of kids) c.cancel();
  }

  noteChildDone(): void {
    if (this.cancelled || this.finished) return;
    this.outstanding -= 1;
    if (this.outstanding <= 0) {
      this.finished = true;
      this.supervisor.cancel();
    }
  }

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
    const entry: PendingEntry = {
      timer: null,
      resolvedAt: this.timers.now() + delayMs,
      fire: () => {},
      remainingMs: delayMs,
      paused: false,
    };
    entry.fire = (): void => {
      if (this.cancelled) return;
      const idx = this.pending.indexOf(entry);
      if (idx >= 0) this.pending.splice(idx, 1);
      fire();
    };
    if (this.paused_) {
      entry.paused = true;
    } else {
      entry.timer = this.timers.setTimer(entry.fire, delayMs);
    }
    this.pending.push(entry);
  }

  cancel(): void {
    // Route through the supervisor so the animator's id table is kept in
    // sync. The supervisor's onCancel forwards back to
    // handleSupervisorCancel which actually tears down children + timers.
    this.supervisor.cancel();
  }

  pause(): void {
    if (this.paused_) return;
    this.paused_ = true;
    const now = this.timers.now();
    for (const p of this.pending) {
      if (p.timer != null) {
        p.remainingMs = Math.max(0, p.resolvedAt - now);
        this.timers.clearTimer(p.timer);
        p.timer = null;
        p.paused = true;
      }
    }
    for (const c of this.children) c.pause();
  }

  resume(): void {
    if (!this.paused_) return;
    this.paused_ = false;
    const now = this.timers.now();
    for (const p of this.pending) {
      if (p.paused) {
        p.resolvedAt = now + p.remainingMs;
        p.timer = this.timers.setTimer(p.fire, p.remainingMs);
        p.paused = false;
      }
    }
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
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle;
export function createStagger<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem>;
export function createStagger<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory?: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle | StaggerBuilder<TItem> {
  if (factory) return runStagger(timers, createSupervisor, watchCompletion, items, delay, factory, opts);
  return makeBuilder(animator, timers, createSupervisor, watchCompletion, items, delay);
}

function runStagger<TItem>(
  timers: StaggerTimers,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle {
  const supervisor = createSupervisor(opts?.cancelKey);
  const composite = new CompositeHandle(timers, supervisor, items.length);
  if (items.length === 0) {
    supervisor.cancel();
    return composite;
  }
  items.forEach((item, i) => {
    const ms = delayFor(delay, i);
    const fire = (): void => {
      const child = factory(item, i);
      // Hook into the child's deregistration (natural OR cancel). If the
      // composite is already cancelled, the watcher fires immediately on
      // cancel and the noteChildDone branch is a no-op (cancelled guard).
      watchCompletion(child.id, () => composite.noteChildDone());
      composite.addChild(child);
    };
    if (ms <= 0) fire();
    else composite.schedule(ms, fire);
  });
  return composite;
}

function resolvePerItem<T, TItem>(
  v: StaggerPerItem<T, TItem>,
  item: TItem,
  i: number,
): T {
  return typeof v === 'function'
    ? (v as (item: TItem, index: number) => T)(item, i)
    : v;
}

function itemId(item: unknown): string {
  if (item != null && typeof item === 'object' && 'id' in item) {
    const id = (item as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  throw new Error(
    'stagger().springPose: each item must either be a primitive (string/number) ' +
      'or have a string `id` field. Otherwise pose ids would collide.',
  );
}

function makeBuilder<TItem>(
  animator: Animator,
  timers: StaggerTimers,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  return {
    each: (factory) =>
      runStagger(timers, createSupervisor, watchCompletion, items, delay, factory),
    tween: <T,>(opts: StaggerTweenOptions<T, TItem>) =>
      runStagger(timers, createSupervisor, watchCompletion, items, delay, (item, i) =>
        animator.tween<T>({
          from: resolvePerItem(opts.from, item, i),
          to: resolvePerItem(opts.to, item, i),
          ms: resolvePerItem(opts.ms, item, i),
          easing: opts.easing,
          interpolate: opts.interpolate,
          onTick: (v) => opts.onTick(v, item, i),
          onDone: opts.onDone ? () => opts.onDone!(item, i) : undefined,
        }),
      ),
    springPose: <TPose,>(
      adapter: SceneAdapter<{ id: string }, TPose>,
      poseFn: (item: TItem, index: number) => TPose,
      opts: StaggerSpringPoseOptions<TPose> = {},
    ) =>
      runStagger(timers, createSupervisor, watchCompletion, items, delay, (item, i) =>
        springPose(animator, adapter, {
          id: itemId(item),
          to: poseFn(item, i),
          preset: opts.preset,
          stiffness: opts.stiffness,
          damping: opts.damping,
          mass: opts.mass,
          geometry: opts.geometry,
          recordOp: opts.recordOp,
          opLabel: opts.opLabel,
        }),
      ),
  };
}
