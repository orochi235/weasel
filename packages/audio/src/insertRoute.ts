import { buildSlot, retireSlot, type Slot } from './insertSlot';
import type { Step } from './insertPlan';
import { writeParam } from './param';

/** A gain between two consecutive points of the chain — the thing that fades
 *  when a route changes. */
interface Link { from: AudioNode; to: AudioNode; gain: GainNode }

/** The audio graph's side of an insert chain: which slots it routes through, and the links between them. */
export interface InsertRoute {
  /** The slots the audio graph routes through, in graph order. */
  readonly live: readonly Slot[];
  /** Whether `s` is in the graph, or leaving it on a crossfade in flight. */
  holds(s: Slot): boolean;
  /** Start `step`'s crossfade and return what finishes it. */
  begin(step: Step, ms: number): () => void;
  /** Cut every link at once and wire `head` straight to `tail`; returns the slots the graph held. */
  drop(): { live: Slot[]; leaving: Slot | null };
}

/** Wire `head` straight to `tail`, ready for slots to be spliced in between. */
export function createInsertRoute(ctx: BaseAudioContext, head: AudioNode, tail: AudioNode): InsertRoute {
  const live: Slot[] = [];
  const links: Link[] = [];
  /** The slot a crossfade in flight is taking out of the graph, whose finish disposes it if removed. */
  let leaving: Slot | null = null;

  const link = (from: AudioNode, to: AudioNode, gain: number): Link => {
    const g = ctx.createGain();
    // `.value` first, so `writeParam` anchors a ramp at it rather than at 1.
    g.gain.value = gain;
    writeParam(ctx, g.gain, gain);
    from.connect(g);
    g.connect(to);
    const l = { from, to, gain: g };
    links.push(l);
    return l;
  };

  const unlink = (l: Link): void => {
    l.from.disconnect(l.gain);
    l.gain.disconnect();
    links.splice(links.indexOf(l), 1);
  };

  const find = (from: AudioNode, to: AudioNode): Link =>
    links.find((l) => l.from === from && l.to === to)!;

  const inOf = (s: Slot | null): AudioNode => (s ? s.nodes!.in : tail);
  const outOf = (s: Slot | null): AudioNode => (s ? s.nodes!.out : head);

  const spliceIn = (s: Slot, at: number, ms: number): (() => void) => {
    buildSlot(ctx, s);
    const prev = live[at - 1] ?? null;
    const next = live[at] ?? null;
    const old = find(outOf(prev), inOf(next));
    link(outOf(prev), inOf(s), 1);
    const incoming = link(outOf(s), inOf(next), 0);
    live.splice(at, 0, s);
    writeParam(ctx, old.gain.gain, 0, ms);
    writeParam(ctx, incoming.gain.gain, 1, ms);
    return () => unlink(old);
  };

  const spliceOut = (s: Slot, ms: number): (() => void) => {
    const i = live.indexOf(s);
    const prev = live[i - 1] ?? null;
    const next = live[i + 1] ?? null;
    const into = find(outOf(prev), inOf(s));
    const from = find(outOf(s), inOf(next));
    const direct = link(outOf(prev), inOf(next), 0);
    live.splice(i, 1);
    leaving = s;
    writeParam(ctx, from.gain.gain, 0, ms);
    writeParam(ctx, direct.gain.gain, 1, ms);
    return () => {
      leaving = null;
      unlink(into);
      unlink(from);
      if (s.removed) retireSlot(s);
    };
  };

  link(head, tail, 1);

  return {
    live,
    holds: (s) => live.includes(s) || leaving === s,
    begin: (step, ms) => (step.kind === 'in' ? spliceIn(step.slot, step.at, ms) : spliceOut(step.slot, ms)),
    drop() {
      const held = { live: [...live], leaving };
      live.length = 0;
      leaving = null;
      for (const l of [...links]) unlink(l);
      link(head, tail, 1);
      return held;
    },
  };
}
