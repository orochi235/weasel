import type { Timers } from '../audioTime';
import { createFader, type Fader } from './fader';
import type { GraphNodeDef } from './types';
import { releaseOutgoing, startWrapper, type NodeWrapper, type Outgoing } from './wrapper';

export interface ReplaceHooks {
  /** Close every edge into `w.ins.get(port)`; called before the port is dropped. */
  closePort(port: string): void;
  /** Called when the old def has faded out and been disposed, to wake `settled`. */
  onSettle(): void;
}

/**
 * Crossfade `w` from its def to `next` over `ms`, keeping its stable `ins`,
 * `out`, edges and taps. The old def keeps its input and output faders, which
 * close; `next` gets fresh ones, which open. A def still fading in from an
 * earlier replace closes from wherever its fade got to.
 */
export function replaceDef(
  ctx: BaseAudioContext,
  timers: Timers,
  w: NodeWrapper,
  next: GraphNodeDef,
  ms: number,
  playing: boolean,
  hooks: ReplaceHooks,
): void {
  const old: Outgoing = {
    def: w.def,
    faders: [...w.inFaders.values(), w.outFader],
    running: w.running,
  };
  w.outgoing.add(old);

  for (const port of [...w.ins.keys()]) {
    if (Object.hasOwn(next.inputs, port)) continue;
    hooks.closePort(port);
    w.ins.delete(port);
    w.inFaders.delete(port);
  }
  for (const port of Object.keys(next.inputs)) {
    let gain = w.ins.get(port);
    if (!gain) w.ins.set(port, (gain = ctx.createGain()));
    w.inFaders.set(port, openFader(ctx, timers, gain, next.inputs[port], ms));
  }
  w.outFader = openFader(ctx, timers, next.output, w.out, ms);
  w.def = next;
  w.running = false;

  let open = old.faders.length;
  for (const f of old.faders) {
    f.close(ms, () => {
      open -= 1;
      if (open > 0 || !w.outgoing.has(old)) return;
      releaseOutgoing(w, old, ctx.currentTime);
      hooks.onSettle();
    });
  }
  if (playing) startWrapper(w, ctx.currentTime);
}

function openFader(
  ctx: BaseAudioContext,
  timers: Timers,
  from: AudioNode,
  to: AudioNode,
  ms: number,
): Fader {
  const f = createFader(ctx, timers, from, to);
  f.open(ms);
  return f;
}
