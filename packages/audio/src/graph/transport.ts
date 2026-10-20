import { atAudioTime, type Timers } from '../audioTime';
import { writeParam } from '../param';
import { startWrapper, stopWrapper, type NodeWrapper } from './wrapper';

export interface TransportDeps {
  ctx: BaseAudioContext;
  timers: Timers;
  fade(): number;
  /** The graph's output gain, which a start fades in and a stop fades to silence. */
  output: GainNode;
  /** The wrappers a start starts. */
  live(): NodeWrapper[];
  /** The wrappers a stop stops, leaving ones included. */
  all(): NodeWrapper[];
  /** Called when an output fade finishes, to wake `settled`. */
  onSettle(): void;
}

/** Start and stop: sources follow `playing`, and the output fades in on a start
 *  and out on a stop, which stops the sources once it is silent. */
export function createTransport(deps: TransportDeps) {
  const { ctx, timers, output } = deps;
  let playing = false;
  /** Cancels the output fade in flight, in either direction. */
  let cancel: (() => void) | null = null;

  /** Ramp the output to `value`, then run `then`; tracked until it lands. */
  const fadeOutput = (value: number, then: () => void): void => {
    cancel?.();
    cancel = null;
    const ms = deps.fade();
    writeParam(ctx, output.gain, value, ms);
    let pending = true;
    const c = atAudioTime(ctx, timers, ctx.currentTime + ms / 1000, () => {
      pending = false;
      cancel = null;
      then();
      deps.onSettle();
    });
    if (pending) cancel = c;
  };

  return {
    playing: () => playing,
    /** An output fade is in flight. */
    busy: () => cancel !== null,
    start(): void {
      if (playing) return;
      playing = true;
      fadeOutput(1, () => {});
      for (const w of deps.live()) startWrapper(w, ctx.currentTime);
    },
    stop(): void {
      if (!playing) return;
      playing = false;
      fadeOutput(0, () => {
        for (const w of deps.all()) stopWrapper(w, ctx.currentTime);
      });
    },
    /** Cancel the fade in flight and forget playing; the caller stops the sources. */
    dispose(): void {
      cancel?.();
      cancel = null;
      playing = false;
    },
  };
}
