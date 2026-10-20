import { atAudioTime, type Timers } from '../audioTime';
import { initParam, writeParam } from '../param';

export interface Fader {
  readonly gain: GainNode;
  /** Ramp to 1 over `ms`. */
  open(ms: number): void;
  /** Ramp to 0 over `ms`, then disconnect both ends and call `done`. Idempotent. */
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
  let closing = false;
  let cutDone = false;

  const cut = (): void => {
    cancel?.();
    cancel = null;
    if (cutDone) return;
    cutDone = true;
    from.disconnect(gain);
    gain.disconnect();
  };

  return {
    gain,
    open(ms) {
      writeParam(ctx, gain.gain, 1, ms);
    },
    close(ms, done) {
      if (closing || cutDone) return;
      closing = true;
      const length = ctx.state === 'running' ? ms : 0;
      writeParam(ctx, gain.gain, 0, length);
      cancel = atAudioTime(ctx, timers, ctx.currentTime + length / 1000, () => {
        cancel = null;
        cut();
        done?.();
      });
    },
    cut,
  };
}
