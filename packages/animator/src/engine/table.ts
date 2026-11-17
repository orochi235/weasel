import type { AnimatorEventHub } from '../observe';
import type { WatchCompletion } from '../supervisor';
import type { TargetState } from '../target';
import type { AnimationHandle, AnimationInfo } from '../types';
import type { Codec } from './codec';
import { createCompletions } from './completions';
import type { ActiveAnimation, AnimationSeed } from './context';
import { createRoster } from './roster';

/** What {@link createTable} needs of the animator around it. */
export interface TableHost {
  codec: Pick<Codec, 'stop' | 'has' | 'rate'>;
  hub: AnimatorEventHub;
  /** The animator's clock: the virtual ms its frames have advanced it by. */
  elapsed(): number;
  /** -1 while the animator plays backward, else 1. */
  direction(): number;
  /** Starts the frame clock where it stands idle, so a new animation is charged the wait for
   *  its first frame. */
  seedClock(): void;
  /** Shows a target as an animation starts on it. */
  showNow(target: TargetState): void;
  /** Whether a target came to rest and is owed one more show. */
  resting(): boolean;
  /** Whether a frame is between reading the codec and showing its targets. */
  framing(): boolean;
  requestFrame(): void;
}

/** The animator's running animations, and how one joins and leaves. */
export interface Table {
  readonly animations: Map<number, ActiveAnimation>;
  infoOf(a: ActiveAnimation): AnimationInfo;
  /** Reports `id` as finished, ahead of its `onDone`, so whatever that handler starts is heard
   *  after it. Nothing revives a primitive; a timeline, which can be revived, is reported as it
   *  leaves the table. */
  reportEnd(id: number): void;
  /** Takes `id` off the table as canceled, or, given `by`, as interrupted by the animation
   *  claiming its key; given `error`, the caller reports it. */
  retire(id: number, by?: ActiveAnimation, error?: true): void;
  cancelByKey(key: string, by?: ActiveAnimation): void;
  /** The animations holding `key`, in the order they registered. */
  under(key: string): Iterable<ActiveAnimation>;
  /** The animations moving `target`, in the order they registered. */
  on(target: TargetState): Iterable<ActiveAnimation>;
  /** Sets `a`'s pause and time scale, and gives its codec subject the rate they ask for. */
  pace(a: ActiveAnimation, paused: boolean, timeScale: number): void;
  /** Runs `flip`, which turns the animator's direction, and gives every animation the rate that
   *  leaves it, its clock where it stands. */
  turn(flip: () => void): void;
  /** `a`'s own clock now, in virtual ms. */
  clockOf(a: ActiveAnimation): number;
  /** The rate `a`'s clock runs at: 0 while paused, below 0 while it plays backward. */
  rateOf(a: ActiveAnimation): number;
  /** Leaves `id` unticked until its clock has run `ms` more. */
  defer(id: number, ms: number): void;
  /** The animations to tick this frame, in the order they registered. */
  ticks(): ActiveAnimation[];
  /** Whether any animation changes from one frame to the next. */
  readonly awake: boolean;
  /** How many animations no frame ticks until they are due. */
  readonly waiting: number;
  register(seed: AnimationSeed): AnimationHandle;
  /** Takes `id` off the table as finished. */
  finish(id: number): void;
  /** Takes `a` off the table with no report of its own: it ended and then threw. */
  drop(a: ActiveAnimation): void;
  /** Cancels everything. `cleared` runs once the table is empty, ahead of the reports. */
  cancelAll(cleared: () => void): void;
  watchCompletion: WatchCompletion;
}

/** `scale` as a time scale, refused where it is no finite number. Below 0 plays backward. */
export function timeScaleOf(scale: number): number {
  if (!Number.isFinite(scale)) throw new Error(`animator: a time scale is a finite number, and ${scale} was given`);
  return scale;
}

/** Runs `each` over `all`, every one of them though one throws; then throws the first throw. */
function each<A>(all: Iterable<A>, run: (a: A) => void): void {
  let threw = false;
  let first: unknown;
  for (const a of all) {
    try { run(a); } catch (error) {
      if (!threw) first = error;
      threw = true;
    }
  }
  if (threw) throw first;
}

/** Runs `run`, answering whether it threw and what. */
function attempt(run: () => void): [boolean, unknown] {
  try {
    run();
    return [false, undefined];
  } catch (error) {
    return [true, error];
  }
}

/** The handle on animation `id`, which `live` answers while it is on the table. */
function handleOf(
  id: number, live: () => ActiveAnimation | undefined, retire: (id: number) => void,
  pace: (a: ActiveAnimation, paused: boolean, timeScale: number) => void,
): AnimationHandle {
  return {
    id,
    cancel: () => retire(id),
    pause: () => { const a = live(); if (a) pace(a, true, a.timeScale); },
    resume: () => { const a = live(); if (a) pace(a, false, a.timeScale); },
    setTimeScale: (s) => { const a = live(); if (a) pace(a, a.paused, timeScaleOf(s)); },
    timeScale: () => live()?.timeScale ?? 1,
    isPaused: () => live()?.paused ?? false,
  };
}

function infoOf(a: ActiveAnimation): AnimationInfo {
  if (!a.info) {
    const info: { -readonly [K in keyof AnimationInfo]: AnimationInfo[K] } = { id: a.id, kind: a.kind };
    if (a.cancelKey != null) info.key = a.cancelKey;
    if (a.label != null) info.label = a.label;
    a.info = info;
  }
  return a.info;
}

export function createTable(host: TableHost): Table {
  const { codec, hub } = host;
  const roster = createRoster(host.elapsed, host.direction);
  const { animations, schedule, remove } = roster;
  const { fire: fireCompletion, watch: watchCompletion } = createCompletions((id) => animations.has(id));

  const reportEnd = (id: number): void => {
    const a = animations.get(id);
    if (!a || a.ended) return;
    a.ended = true;
    if (hub.watched) hub.emit({ type: 'end', animation: infoOf(a) });
  };

  const retire = (id: number, by?: ActiveAnimation, error?: true): void => {
    const a = animations.get(id);
    if (!a) return;
    // A throw from it, a target's setter as the animation commits, still takes it off the table;
    // the throw goes on after, but one retired for a throw of its own has had its throw reported.
    const [threw, thrown] = attempt(() => a.onCancel?.());
    codec.stop(id);
    remove(a);
    // A target that came to rest is owed one more show, and no frame may be coming. A frame in
    // progress shows it itself, and asks for the next after its ticks, as `register` says.
    if (host.resting() && !host.framing()) host.requestFrame();
    fireCompletion(id);
    if (hub.watched && !a.ended && !error) {
      hub.emit(by
        ? { type: 'interrupt', animation: infoOf(a), by: infoOf(by) }
        : { type: 'cancel', animation: infoOf(a) });
    }
    if (!threw) return;
    if (error) console.error('useAnimator: canceling an animation that threw threw again', thrown);
    else throw thrown;
  };

  const cancelByKey = (key: string, by?: ActiveAnimation): void => {
    // A copy: each one leaves the set as it is retired, and its `onCancel` may retire others.
    each([...roster.under(key)], (a) => retire(a.id, by));
  };

  /** Hands `a`'s voices the rate its schedule now gives it. */
  const rerate = (a: ActiveAnimation): void => {
    const rate = schedule.rateOf(a);
    if (codec.has(a.id)) codec.rate(a.id, rate);
    a.onRate?.(a.paused, a.timeScale, rate);
  };
  const pace = (a: ActiveAnimation, paused: boolean, timeScale: number): void => {
    schedule.pace(a, paused, timeScale);
    rerate(a);
  };

  const register = (seed: AnimationSeed): AnimationHandle => {
    const anim = seed as ActiveAnimation;
    if (seed.cancelKey != null && !seed.keepExisting) cancelByKey(seed.cancelKey, anim);
    anim.paused = false;
    anim.timeScale = 1;
    // Its clock starts with the frame clock, as a voice cued now does: both then advance by
    // the whole of their first frame. Idle, that frame is the wait since the first of the
    // animations it finds was registered.
    host.seedClock();
    roster.add(anim);
    if (host.direction() < 0) rerate(anim);
    if (anim.target) host.showNow(anim.target);
    if (hub.watched) hub.emit({ type: 'start', animation: infoOf(anim) });
    // A frame in progress asks for the next one itself, after `onTick`: asked for from a tick,
    // it would run ahead of a paint `onTick` requests, and the tick after would paint nothing.
    if (animations.size > 0 && !host.framing()) host.requestFrame();
    return handleOf(anim.id, () => animations.get(anim.id), retire, pace);
  };

  return {
    animations,
    infoOf,
    reportEnd,
    retire,
    cancelByKey,
    under: roster.under,
    on: roster.on,
    pace,
    turn(flip) {
      schedule.turn(animations.values(), flip);
      for (const a of [...animations.values()]) if (animations.get(a.id) === a) rerate(a);
    },
    clockOf: schedule.clockOf,
    rateOf: schedule.rateOf,
    defer: (id, ms) => schedule.defer(animations.get(id), ms),
    ticks: schedule.ticks,
    get awake() { return schedule.awake; },
    get waiting() { return schedule.waiting; },
    register,
    finish(id) {
      const a = animations.get(id);
      if (!a) return;
      reportEnd(id);
      remove(a);
      fireCompletion(id);
    },
    drop(a) {
      remove(a);
      fireCompletion(a.id);
    },
    cancelAll(cleared) {
      const retired: ActiveAnimation[] = [];
      // Over the table as it stands: one an earlier `onCancel` retired is not canceled twice. A
      // throw from one, a target's setter, cancels the rest all the same and goes on after.
      const [threw, thrown] = attempt(() => each(animations.values(), (a) => {
        retired.push(a);
        try { a.onCancel?.(); } finally { codec.stop(a.id); }
      }));
      roster.clear();
      cleared();
      for (const a of retired) fireCompletion(a.id);
      // One reported ended already, from an `onDone` that called this, was not canceled.
      if (hub.watched) for (const a of retired) if (!a.ended) hub.emit({ type: 'cancel', animation: infoOf(a) });
      if (threw) throw thrown;
    },
    watchCompletion,
  };
}
