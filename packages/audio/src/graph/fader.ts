import { atAudioTime, type Timers } from '../audioTime';
import { initParam, writeParam } from '../param';

export interface Fader {
  readonly gain: GainNode;
  /** Ramp to 1 over `ms`, then call `done`, unless a close or cut comes first. */
  open(ms: number, done?: () => void): void;
  /** An open's ramp is still in flight. */
  opening(): boolean;
  /** Ramp to 0 over `ms`, then disconnect both ends and call `done`. A close already
   *  under way keeps its length, and each distinct `done` runs once when it lands. */
  close(ms: number, done?: () => void): void;
  /** Disconnect now, canceling any pending close. */
  cut(): void;
}

/** A gain from `from` to `to`, starting silent: the unit every graph edit fades through. */
export function createFader(
  ctx: BaseAudioContext,
  timers: Timers,
  from: AudioNode,
  to: AudioNode,
): Fader {
  const gain = ctx.createGain();
  initParam(ctx, gain.gain, 0);
  from.connect(gain);
  gain.connect(to);

  let cancel: (() => void) | null = null;
  let cancelOpen: (() => void) | null = null;
  let closing = false;
  let closed = false;
  let cutDone = false;
  const dones = new Set<() => void>();

  const stopOpening = (): void => {
    cancelOpen?.();
    cancelOpen = null;
  };
  const cut = (): void => {
    stopOpening();
    cancel?.();
    cancel = null;
    if (cutDone) return;
    cutDone = true;
    from.disconnect(gain);
    gain.disconnect();
  };

  return {
    gain,
    open(ms, done) {
      writeParam(ctx, gain.gain, 1, ms);
      stopOpening();
      let pending = true;
      const c = atAudioTime(ctx, timers, ctx.currentTime + ms / 1000, () => {
        pending = false;
        cancelOpen = null;
        done?.();
      });
      if (pending) cancelOpen = c;
    },
    opening: () => cancelOpen !== null,
    close(ms, done) {
      if (closed) done?.();
      if (closed || cutDone) return;
      if (done) dones.add(done);
      if (closing) return;
      closing = true;
      stopOpening();
      const length = ctx.state === 'running' ? ms : 0;
      writeParam(ctx, gain.gain, 0, length);
      cancel = atAudioTime(ctx, timers, ctx.currentTime + length / 1000, () => {
        cancel = null;
        cut();
        closed = true;
        const all = [...dones];
        dones.clear();
        for (const d of all) d();
      });
    },
    cut,
  };
}
