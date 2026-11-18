import type { AnimationHandle } from '../types';

/** The animator's internal `register`, narrowed to what a timeline needs. */
export type TimelineRegister = (seed: {
  id: number;
  cancelKey?: string;
  /** Registers under an existing `cancelKey` without canceling whoever holds
   *  it. A revived timeline is the same animation, not a new claim on the key. */
  keepExisting?: boolean;
  /** `scale` is the effective time scale this frame advanced at, zero while
   *  paused at any level. */
  tick: (virtualNow: number, scale?: number) => boolean;
  onCancel?: () => void;
  kind: 'timeline';
  label?: string;
  progress?: () => number;
}) => AnimationHandle;

/** A timeline's place on the animator's table, and the playback its consumer asked for. The
 *  intent is kept here, not read back from the animator: a revived timeline is a fresh
 *  registration, which defaults to running at scale 1. */
export interface TimelineEntry {
  /** The handle of the first registration; a revival registers under the same id. */
  readonly base: AnimationHandle;
  /** Whether it is on the animator's table. */
  live(): boolean;
  /** Notes that it has left the table. */
  retire(): void;
  /** Puts it back on the table, at the playback last asked for. */
  revive(): void;
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
  timeScale(): number;
  isPaused(): boolean;
  /** The time scale last asked for. */
  wantScale(): number;
}

export function createEntry(
  register: TimelineRegister, seed: Parameters<TimelineRegister>[0], paused: boolean,
): TimelineEntry {
  let live = true;
  let wantPaused = paused;
  let wantScale = 1;
  const base = register(seed);
  // A paused entry's scale is zero, so `virtualNow` never advances and the
  // playhead holds at 0 until the consumer resumes.
  if (paused) base.pause();

  return {
    base,
    live: () => live,
    retire() { live = false; },
    revive() {
      live = true;
      register({ ...seed, keepExisting: true });
      if (wantPaused) base.pause();
      base.setTimeScale(wantScale);
    },
    pause() { wantPaused = true; base.pause(); },
    resume() { wantPaused = false; base.resume(); },
    setTimeScale(scale) { wantScale = scale; base.setTimeScale(scale); },
    timeScale: () => (live ? base.timeScale() : wantScale),
    isPaused: () => (live ? base.isPaused() : wantPaused),
    wantScale: () => wantScale,
  };
}
