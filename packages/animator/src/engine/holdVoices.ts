import { patch as fnPatch, tween as tweenPatch, type Handle } from '@msb235/blits';
import type { Out, Slot } from './lanes';

export interface HoldStart {
  id: number; axes: number;
  /** The subject it reaches. */
  on: unknown;
  /** The voice's axes now. Asked every frame, and again after a `touch`. */
  at(): number[];
  /** True where what `at` answers changes only when its subject is touched: it is then asked
   *  after a touch and on no other frame. */
  still?: boolean;
}

/** A hold's voice: one with no clock, which reads `at` for as long as it is cued. */
export interface HoldVoice {
  slot: Slot;
  start: HoldStart;
  /** Absent for a still hold until the touch or frame that first cues it. */
  handle?: Handle<unknown>;
  /** Its axes as `at` last answered. */
  last?: number[];
}

export interface HoldVoices {
  add(slot: Slot, start: HoldStart): HoldVoice;
  /** Says whether `v` is {@link HoldStart.still} from here on. */
  still(v: HoldVoice, still: boolean): void;
  /** Says what the hold on `on` reads has changed, where that hold is still. */
  touch(on: unknown): void;
  /** Cues again each still hold touched since the last call. */
  settle(): void;
  /** Called as a frame starts, ahead of its reading. */
  frame(): void;
  remove(v: HoldVoice): void;
}

export function createHoldVoices(): HoldVoices {
  /** The holds asked every frame. */
  const asked = new Set<HoldVoice>();
  /** The still hold on each subject that has one, and those a touch has left to cue again. */
  const stills = new Map<unknown, HoldVoice>();
  const stale = new Set<HoldVoice>();

  const cue = (v: HoldVoice): void => {
    const { start } = v;
    const { lane, key } = v.slot;
    v.handle?.fade({ over: 0 });
    stale.delete(v);
    if (start.still) {
      v.last = start.at();
      // A motion at rest costs a frame what a finished tween does, and calls nothing of ours.
      const rest = tweenPatch<unknown, Out, number[]>('v', { from: v.last, to: v.last.slice(), ms: 1 });
      v.handle = lane.mix.cue({ patch: rest, subjects: [key] });
      return;
    }
    const each = fnPatch<unknown, Out>(
      1,
      () => {
        v.last = start.at();
        return { v: v.last };
      },
      { writes: ['v'] },
    );
    v.handle = lane.mix.cue({ patch: each, subjects: [key], loop: true });
  };

  const settle = (): void => {
    for (const v of stale) cue(v);
  };

  return {
    add(slot, start) {
      const v: HoldVoice = { slot, start: { ...start } };
      if (start.still) {
        // Cued at the touch or frame that comes first, so one touched as it starts is asked once.
        stills.set(start.on, v);
        stale.add(v);
      } else {
        cue(v);
        asked.add(v);
      }
      return v;
    },
    still(v, still) {
      if (!v.start.still === !still) return;
      v.start.still = still;
      if (still) {
        asked.delete(v);
        stills.set(v.start.on, v);
      } else {
        stills.delete(v.start.on);
        asked.add(v);
      }
      cue(v);
    },
    touch(on) {
      const v = stills.get(on);
      if (v) stale.add(v);
    },
    settle,
    frame() {
      // blits keeps a patch's answer while its clock stands still, and a hold's can change anyway.
      for (const v of asked) v.slot.lane.mix.touch(v.slot.key);
      settle();
    },
    remove(v) {
      v.handle?.fade({ over: 0 });
      asked.delete(v);
      stale.delete(v);
      if (stills.get(v.start.on) === v) stills.delete(v.start.on);
    },
  };
}
