import type { AnalyserTap } from '../analyser';
import type { Timers } from '../audioTime';
import { createFader, type Fader } from './fader';
import type { GraphNodeDef } from './types';

/**
 * One node of the graph. Edges attach only to the stable `ins` and `out`, and
 * the def sits between them behind faders, so a def can be crossfaded out for
 * another without touching a single edge or tap.
 */
export interface NodeWrapper {
  readonly id: string;
  def: GraphNodeDef;
  /** One stable gain per input port; each feeds `def.inputs[port]` through `inFaders[port]`. */
  readonly ins: Record<string, GainNode>;
  readonly inFaders: Record<string, Fader>;
  /** The stable output, fed by `def.output` through `outFader`. */
  readonly out: GainNode;
  outFader: Fader;
  readonly taps: Set<AnalyserTap>;
  /** Whether `def.start` has run since the last `def.stop`. */
  running: boolean;
}

export function createWrapper(
  ctx: BaseAudioContext,
  timers: Timers,
  id: string,
  def: GraphNodeDef,
): NodeWrapper {
  const ins: Record<string, GainNode> = {};
  const inFaders: Record<string, Fader> = {};
  for (const port of Object.keys(def.inputs)) {
    ins[port] = ctx.createGain();
    inFaders[port] = createFader(ctx, timers, ins[port], def.inputs[port]);
    inFaders[port].open(0);
  }
  const out = ctx.createGain();
  const outFader = createFader(ctx, timers, def.output, out);
  outFader.open(0);
  return { id, def, ins, inFaders, out, outFader, taps: new Set(), running: false };
}

export function startWrapper(w: NodeWrapper, when: number): void {
  if (w.running || !w.def.start) return;
  w.running = true;
  w.def.start(when);
}

export function stopWrapper(w: NodeWrapper, when: number): void {
  if (!w.running) return;
  w.running = false;
  w.def.stop?.(when);
}

/** Tear down a wrapper whose edges are already cut. Its faders go before
 *  `def.dispose`, which may blanket-disconnect the nodes they are wired from. */
export function releaseWrapper(w: NodeWrapper, when: number): void {
  stopWrapper(w, when);
  for (const f of Object.values(w.inFaders)) f.cut();
  w.outFader.cut();
  for (const t of w.taps) t.dispose();
  w.taps.clear();
  w.def.dispose?.();
}
