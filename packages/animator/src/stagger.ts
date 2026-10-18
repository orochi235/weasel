import { isTarget, type Target } from './target';
import type { Supervisor, SupervisorFactory, WatchCompletion } from './supervisor';
import type {
  AnimationHandle,
  Animator,
  StaggerBuilder,
  StaggerDelay,
  StaggerFactory,
  StaggerOptions,
  SpringOptions,
  StaggerPerItem,
  StaggerSpringOptions,
  StaggerTargetSpringOptions,
  StaggerTargetTweenOptions,
  StaggerTweenOptions,
  TweenOptions,
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
  private canceled = false;
  private paused_ = false;
  private timeScale_ = 1;
  private children: AnimationHandle[] = [];
  private pending: PendingEntry[] = [];
  private outstanding: number;
  /** Children started and not yet done. */
  private running = 0;
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

  /** Invoked when the supervisor is canceled externally (animator.cancel /
   *  cancelKey) OR via this composite's own `cancel`. */
  private handleSupervisorCancel(): void {
    if (this.canceled) return;
    this.canceled = true;
    this.pending = [];
    // Snapshot children first: child.cancel() may synchronously invoke our
    // own noteChildDone path via the animator's completion listener, which
    // would mutate this.children mid-iteration.
    const kids = this.children.slice();
    this.children = [];
    for (const c of kids) c.cancel();
  }

  noteChildDone(): void {
    if (this.canceled || this.finished) return;
    this.outstanding -= 1;
    this.running -= 1;
    if (this.outstanding <= 0) this.finish();
    else this.rewound();
  }

  private finish(): void {
    this.finished = true;
    this.children = [];
    this.pending = [];
    this.supervisor.finish();
  }

  /** Played backward, it ends once every item running has run back to its start: the items
   *  still waiting are not reached going that way. */
  private rewound(): void {
    if (this.running <= 0 && this.supervisor.rate() < 0) this.finish();
  }

  addChild(h: AnimationHandle): void {
    if (this.canceled) {
      h.cancel();
      return;
    }
    this.running += 1;
    this.children.push(h);
    if (this.paused_) h.pause();
    if (this.timeScale_ !== 1) h.setTimeScale(this.timeScale_);
  }

  schedule(delayMs: number, fire: () => void): void {
    if (this.canceled) return;
    this.pending.push({ at: delayMs, fire });
  }

  private fireDue(virtualNow: number): void {
    if (this.canceled || this.finished) return;
    this.rewound();
    if (this.finished || this.pending.length === 0) return;
    const due = this.pending.filter((p) => p.at <= virtualNow).sort((a, b) => a.at - b.at);
    this.pending = this.pending.filter((p) => p.at > virtualNow);
    for (const p of due) {
      if (this.canceled) return;
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
      // composite is already canceled, the watcher fires immediately on
      // cancel and the noteChildDone branch is a no-op (canceled guard).
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

/** What `.tween` and `.spring` read of their options, whichever form those take. */
interface PerItemOptions<TItem> extends StaggerOptions {
  target?: StaggerPerItem<Target<unknown>, TItem>;
  from?: StaggerPerItem<unknown, TItem>;
  to: StaggerPerItem<unknown, TItem>;
  onTick?: (value: unknown, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
}

/** One item's share of a builder method's options: its target, or null where its animation
 *  hands values to `onTick`, and the options every form of the animation takes. */
function perItem<TItem>(opts: PerItemOptions<TItem>, item: TItem, i: number) {
  const target = opts.target !== undefined ? resolvePerItem(opts.target, item, i) : isTarget(item) ? item : null;
  return {
    target,
    from: opts.from === undefined ? undefined : resolvePerItem(opts.from, item, i),
    to: resolvePerItem(opts.to, item, i),
    onTick: opts.onTick && ((v: unknown) => opts.onTick!(v, item, i)),
    onDone: opts.onDone && (() => opts.onDone!(item, i)),
  };
}

function makeBuilder<TItem>(
  animator: Animator,
  createSupervisor: SupervisorFactory,
  watchCompletion: WatchCompletion,
  items: readonly TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  /** Runs `start` per item, once every item has a target to move or an `onTick` to tell. */
  const run = <O extends PerItemOptions<TItem>>(
    method: string,
    opts: O,
    start: (own: ReturnType<typeof perItem<TItem>>, item: TItem, i: number) => AnimationHandle,
  ): AnimationHandle => {
    if (opts.target === undefined && !opts.onTick && !items.every(isTarget)) {
      throw new Error(`animator.stagger: \`.${method}\` needs a \`target\`, items that are targets, or an \`onTick\``);
    }
    return runStagger(createSupervisor, watchCompletion, items, delay, (item, i) => start(perItem(opts, item, i), item, i), opts);
  };
  return {
    each: (factory, opts) =>
      runStagger(createSupervisor, watchCompletion, items, delay, factory, opts),
    tween: ((opts: StaggerTweenOptions<unknown, TItem> | StaggerTargetTweenOptions<unknown, TItem>) =>
      run('tween', opts, ({ target, ...own }, item, i) => {
        const shared = {
          ...own, ms: resolvePerItem(opts.ms, item, i),
          easing: opts.easing, interpolate: opts.interpolate, interpolator: opts.interpolator,
        };
        return target ? animator.tween({ ...shared, target }) : animator.tween(shared as TweenOptions<unknown>);
      })) as StaggerBuilder<TItem>['tween'],
    spring: ((opts: StaggerSpringOptions<unknown, TItem> | StaggerTargetSpringOptions<unknown, TItem>) =>
      run('spring', opts, ({ target, ...own }, item, i) => {
        const shared = {
          ...own, velocity: opts.velocity === undefined ? undefined : resolvePerItem(opts.velocity, item, i),
          preset: opts.preset, stiffness: opts.stiffness, damping: opts.damping, mass: opts.mass,
          restThreshold: opts.restThreshold,
        };
        if (target) return animator.spring({ ...shared, target });
        const { interpolate, add, subtract, scale, magnitude } = opts as StaggerSpringOptions<unknown, TItem>;
        return animator.spring({ ...shared, interpolate, add, subtract, scale, magnitude } as SpringOptions<unknown>);
      })) as StaggerBuilder<TItem>['spring'],
  };
}
