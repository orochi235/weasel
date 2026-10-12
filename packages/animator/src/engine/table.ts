import type { AnimatorEventHub } from '../observe';
import type { WatchCompletion } from '../supervisor';
import type { TargetState } from '../target';
import type { AnimationHandle, AnimationInfo } from '../types';
import type { Codec } from './codec';
import { createCompletions } from './completions';
import type { ActiveAnimation, AnimationSeed } from './context';

/** What {@link createTable} needs of the animator around it. */
export interface TableHost {
  codec: Pick<Codec, 'stop' | 'has' | 'rate'>;
  hub: AnimatorEventHub;
  /** The time a new animation's clock starts at: the running frame's, else now. */
  startTime(): number;
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
  /** Gives a codec subject the rate its own pause and time scale now ask for. */
  rateOf(a: ActiveAnimation): void;
  register(seed: AnimationSeed): AnimationHandle;
  /** Takes `id` off the table as finished. */
  finish(id: number): void;
  /** Takes `a` off the table with no report of its own: it ended and then threw. */
  drop(a: ActiveAnimation): void;
  /** Cancels everything. `cleared` runs once the table is empty, ahead of the reports. */
  cancelAll(cleared: () => void): void;
  watchCompletion: WatchCompletion;
}

/** `scale` as a time scale, refused below 0: the clock under the animator only goes forward. */
export function timeScaleOf(scale: number): number {
  if (!(scale >= 0)) {
    throw new Error(`animator: a time scale is 0 or above, and ${scale} was given; nothing plays backward`);
  }
  return scale;
}

export function createTable(host: TableHost): Table {
  const { codec, hub } = host;
  const animations = new Map<number, ActiveAnimation>();
  const { fire: fireCompletion, watch: watchCompletion } = createCompletions((id) => animations.has(id));

  const infoOf = (a: ActiveAnimation): AnimationInfo => {
    if (!a.info) {
      const info: { -readonly [K in keyof AnimationInfo]: AnimationInfo[K] } = { id: a.id, kind: a.kind };
      if (a.cancelKey != null) info.key = a.cancelKey;
      if (a.label != null) info.label = a.label;
      a.info = info;
    }
    return a.info;
  };

  const reportEnd = (id: number): void => {
    const a = animations.get(id);
    if (!a || a.ended) return;
    a.ended = true;
    if (hub.watched) hub.emit({ type: 'end', animation: infoOf(a) });
  };

  const retire = (id: number, by?: ActiveAnimation, error?: true): void => {
    const a = animations.get(id);
    if (!a) return;
    a.onCancel?.();
    codec.stop(id);
    animations.delete(id);
    // A target that came to rest is owed one more show, and no frame may be coming.
    if (host.resting()) host.requestFrame();
    fireCompletion(id);
    if (!hub.watched || a.ended || error) return;
    hub.emit(by
      ? { type: 'interrupt', animation: infoOf(a), by: infoOf(by) }
      : { type: 'cancel', animation: infoOf(a) });
  };

  const cancelByKey = (key: string, by?: ActiveAnimation): void => {
    const ids: number[] = [];
    for (const anim of animations.values()) {
      if (anim.cancelKey === key) ids.push(anim.id);
    }
    for (const id of ids) retire(id, by);
  };

  const rateOf = (a: ActiveAnimation): void => {
    if (codec.has(a.id)) codec.rate(a.id, a.paused ? 0 : a.timeScale);
    a.onRate?.(a.paused, a.timeScale);
  };

  const register = (seed: AnimationSeed): AnimationHandle => {
    const anim = seed as ActiveAnimation;
    if (seed.cancelKey != null && !seed.keepExisting) cancelByKey(seed.cancelKey, anim);
    anim.paused = false;
    anim.timeScale = 1;
    anim.virtualNow = 0;
    // Seeded from the frame clock where it is running, as a voice cued now is: both then
    // advance by the whole of their first frame. Idle, the first frame's realDt is the gap
    // between register() and the first RAF callback.
    anim.lastRealNow = host.startTime();
    animations.set(anim.id, anim);
    if (anim.target) host.showNow(anim.target);
    if (hub.watched) hub.emit({ type: 'start', animation: infoOf(anim) });
    // A frame in progress asks for the next one itself, after `onTick`: asked for from a tick,
    // it would run ahead of a paint `onTick` requests, and the tick after would paint nothing.
    if (animations.size > 0 && !host.framing()) host.requestFrame();
    const live = (): ActiveAnimation | undefined => animations.get(anim.id);
    return {
      id: anim.id,
      cancel: () => retire(anim.id),
      pause: () => { const a = live(); if (a) { a.paused = true; rateOf(a); } },
      resume: () => { const a = live(); if (a) { a.paused = false; rateOf(a); } },
      setTimeScale: (s) => { const a = live(); if (a) { a.timeScale = timeScaleOf(s); rateOf(a); } },
      timeScale: () => live()?.timeScale ?? 1,
      isPaused: () => live()?.paused ?? false,
    };
  };

  return {
    animations,
    infoOf,
    reportEnd,
    retire,
    cancelByKey,
    rateOf,
    register,
    finish(id) {
      if (!animations.has(id)) return;
      reportEnd(id);
      animations.delete(id);
      fireCompletion(id);
    },
    drop(a) {
      animations.delete(a.id);
      fireCompletion(a.id);
    },
    cancelAll(cleared) {
      const retired: ActiveAnimation[] = [];
      // Over the table as it stands: one an earlier `onCancel` retired is not canceled twice.
      for (const a of animations.values()) {
        a.onCancel?.();
        codec.stop(a.id);
        retired.push(a);
      }
      animations.clear();
      cleared();
      for (const a of retired) fireCompletion(a.id);
      if (hub.watched) for (const a of retired) hub.emit({ type: 'cancel', animation: infoOf(a) });
    },
    watchCompletion,
  };
}
