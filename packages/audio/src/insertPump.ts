import { atAudioTime, type Timers } from './audioTime';
import type { Step } from './insertPlan';

/** Runs an insert chain's steps one crossfade at a time. */
export interface InsertPump {
  /** Start every step there is, up to the first that has to wait out a fade. */
  pump(): void;
  settled(): Promise<void>;
  /** Cancel the fade in flight and stop for good. */
  stop(): void;
  /** Resolve every `settled()` waiting. */
  release(): void;
}

/** A pump taking each step from `next` and starting it with `begin`, fading over `fade()` ms. */
export function createInsertPump(
  ctx: BaseAudioContext,
  timers: Timers,
  fade: () => number,
  next: () => Step | null,
  begin: (step: Step, ms: number) => () => void,
): InsertPump {
  let busy = false;
  let cancel: (() => void) | null = null;
  let stopped = false;
  let waiters: (() => void)[] = [];

  const release = (): void => {
    const done = waiters;
    waiters = [];
    for (const w of done) w();
  };

  const pump = (): void => {
    while (!busy && !stopped) {
      const step = next();
      if (!step) {
        release();
        return;
      }
      const ms = fade();
      const finish = begin(step, ms);
      if (ms === 0) {
        finish();
        continue;
      }
      busy = true;
      cancel = atAudioTime(ctx, timers, ctx.currentTime + ms / 1000, () => {
        cancel = null;
        busy = false;
        finish();
        pump();
      });
    }
  };

  return {
    pump,
    settled() {
      if (!busy && next() === null) return Promise.resolve();
      return new Promise((resolve) => { waiters.push(resolve); });
    },
    stop() {
      stopped = true;
      cancel?.();
      cancel = null;
    },
    release,
  };
}
