import { springPose, type PoseAnimationAdapter } from './poseHelpers';
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

/** An item still waiting: `fire` starts it once the stagger's own virtual
 *  time reaches `at`. */
interface PendingEntry {
  at: number;
  fire: () => void;
}

/**
 * Composite handle returned by `createStagger`. Owns a list of in-flight
 * child handles and a list of items still waiting; cancel cancels both.
 * Pause/resume/setTimeScale propagate to in-flight children. The waiting
 * items are counted in the supervisor entry's virtual time, so whatever
 * holds or scales that entry holds or scales the delays with it.
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
    private supervisor: Supervisor,
    totalItems: number,
  ) {
    this.id = supervisor.id;
    this.outstanding = totalItems;
    supervisor.setOnCancel(() => this.handleSupervisorCancel());
    supervisor.setOnRate((paused, timeScale) => {
      if (paused) this.applyPause();
      else this.applyResume();
      this.applyTimeScale(timeScale);
    });
    supervisor.setOnFrame((virtualNow) => this.fireDue(virtualNow));
  }

  /** Invoked when the supervisor is cancelled externally (animator.cancel /
   *  cancelKey) OR via this composite's own `cancel`. */
  private handleSupervisorCancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
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
      this.children = [];
      this.supervisor.finish();
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
    this.pending.push({ at: delayMs, fire });
  }

  private fireDue(virtualNow: number): void {
    if (this.cancelled || this.pending.length === 0) return;
    const due = this.pending.filter((p) => p.at <= virtualNow).sort((a, b) => a.at - b.at);
    this.pending = this.pending.filter((p) => p.at > virtualNow);
    for (const p of due) {
      if (this.cancelled) return;
      p.fire();
    }
  }

  cancel(): void {
    // Route through the supervisor so the animator's id table is kept in
    // sync. The supervisor's onCancel forwards back to
    // handleSupervisorCancel which actually tears down children + waiting items.
    this.supervisor.cancel();
  }

  pause(): void {
    this.supervisor.pause();
  }

  resume(): void {
    this.supervisor.resume();
  }

  setTimeScale(s: number): void {
    this.supervisor.setTimeScale(s);
  }

  private applyPause(): void {
    if (this.paused_) return;
    this.paused_ = true;
    for (const c of this.children) c.pause();
  }

  private applyResume(): void {
    if (!this.paused_) return;
    this.paused_ = false;
    for (const c of this.children) c.resume();
  }

  private applyTimeScale(s: number): void {
    if (s === this.timeScale_) return;
    this.timeScale_ = s;
    for (const c of this.children) c.setTimeScale(s);
  }

  timeScale(): number {
    return this.timeScale_;
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
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle;
export function createStagger<TItem>(
  animator: Animator,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem>;
export function createStagger<TItem>(
  animator: Animator,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory?: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle | StaggerBuilder<TItem> {
  if (factory) return runStagger(createSupervisor, watchCompletion, items, delay, factory, opts);
  return makeBuilder(animator, createSupervisor, watchCompletion, items, delay);
}

function runStagger<TItem>(
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
  opts?: StaggerOptions,
): AnimationHandle {
  const supervisor = createSupervisor({ kind: 'stagger', cancelKey: opts?.cancelKey, label: opts?.label });
  const composite = new CompositeHandle(supervisor, items.length);
  if (items.length === 0) {
    supervisor.finish();
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
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  return {
    each: (factory, opts) =>
      runStagger(createSupervisor, watchCompletion, items, delay, factory, opts),
    tween: <T,>(opts: StaggerTweenOptions<T, TItem>) =>
      runStagger(createSupervisor, watchCompletion, items, delay, (item, i) =>
        animator.tween<T>({
          from: resolvePerItem(opts.from, item, i),
          to: resolvePerItem(opts.to, item, i),
          ms: resolvePerItem(opts.ms, item, i),
          easing: opts.easing,
          interpolate: opts.interpolate,
          onTick: (v) => opts.onTick(v, item, i),
          onDone: opts.onDone ? () => opts.onDone!(item, i) : undefined,
        }),
        opts,
      ),
    springPose: <TPose,>(
      adapter: PoseAnimationAdapter<TPose>,
      poseFn: (item: TItem, index: number) => TPose,
      opts: StaggerSpringPoseOptions<TPose> = {},
    ) =>
      runStagger(createSupervisor, watchCompletion, items, delay, (item, i) =>
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
        opts,
      ),
  };
}
