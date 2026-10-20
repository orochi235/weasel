import { atAudioTime, type Timers } from '../audioTime';
import { writeParam } from '../param';
import { startWrapper, stopWrapper, type NodeWrapper } from './wrapper';

export interface TransportDeps {
  ctx: BaseAudioContext;
  timers: Timers;
  fade(): number;
  /** The graph's output gain, which a stop fades to silence. */
  output: GainNode;
  /** The wrappers a start starts. */
  live(): NodeWrapper[];
  /** The wrappers a stop stops, leaving ones included. */
  all(): NodeWrapper[];
  /** Called when a stop's fade finishes, to wake `settled`. */
  onSettle(): void;
}

/** Start and stop: sources follow `playing`, and a stop fades the output before stopping them. */
export function createTransport(deps: TransportDeps) {
  const { ctx, timers, output } = deps;
  let playing = false;
  let cancel: (() => void) | null = null;

  return {
    playing: () => playing,
    /** A stop's fade is in flight. */
    stopping: () => cancel !== null,
    start(): void {
      if (playing) return;
      playing = true;
      cancel?.();
      cancel = null;
      writeParam(ctx, output.gain, 1, deps.fade());
      for (const w of deps.live()) startWrapper(w, ctx.currentTime);
    },
    stop(): void {
      if (!playing) return;
      playing = false;
      const ms = deps.fade();
      writeParam(ctx, output.gain, 0, ms);
      let pending = true;
      const c = atAudioTime(ctx, timers, ctx.currentTime + ms / 1000, () => {
        pending = false;
        cancel = null;
        for (const w of deps.all()) stopWrapper(w, ctx.currentTime);
        deps.onSettle();
      });
      if (pending) cancel = c;
    },
    /** Cancel a stop in flight and forget playing; the caller stops the sources. */
    dispose(): void {
      cancel?.();
      cancel = null;
      playing = false;
    },
  };
}
