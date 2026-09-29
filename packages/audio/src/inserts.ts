import { atAudioTime, defaultTimers, type Timers } from './audioTime';
import { writeParam } from './param';

/**
 * Anything with an input and an output node can sit in an insert slot: one of
 * the built-ins (`createFilterEffect` and the rest), or a pair of nodes of your
 * own — `{ input: shaper, output: shaper }` for a single node. Several nodes
 * between the two are fine too. An effect goes in one slot, once.
 */
export interface InsertEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Called once the effect has left the graph after `remove()` or `clear()`. */
  dispose?(): void;
}

/** One effect's place in a bus's insert chain. Every edit is click-free: a
 *  bypass crossfades the slot's wet and dry, and a structural edit crossfades
 *  the old route into the new one. */
export interface InsertSlot {
  readonly effect: InsertEffect;
  /** Route around the effect (`true`) or back through it. */
  bypass(on: boolean): void;
  bypassed(): boolean;
  /** Clamped to the chain. */
  moveTo(index: number): void;
  /** Take the effect out, then call its `dispose`. Idempotent. */
  remove(): void;
  /** Position in the chain, or -1 once removed. */
  index(): number;
}

export interface InsertAddOptions {
  /** Default: the end of the chain. Clamped. */
  index?: number;
  /** Add it routed around, for a later `bypass(false)`. Default false. */
  bypassed?: boolean;
}

/**
 * A bus's ordered insert effects, between where voices connect and the bus's
 * fader. `slots()` is the chain as edited; the audio graph follows one
 * crossfade at a time, and `settled()` resolves once it has caught up.
 */
export interface InsertChain {
  add(effect: InsertEffect, opts?: InsertAddOptions): InsertSlot;
  slots(): InsertSlot[];
  clear(): void;
  settled(): Promise<void>;
}

export interface InsertChainOptions extends Partial<Timers> {
  /** Crossfade length for every edit, in ms. Default 15. */
  fadeMs?: number;
}

/** A chain and the switch that cancels its transition in flight. */
export interface OwnedInsertChain {
  chain: InsertChain;
  dispose(): void;
}

interface Slot {
  handle: InsertSlot;
  effect: InsertEffect;
  bypassed: boolean;
  removed: boolean;
  /** Built on first splice-in, kept across a move, torn down on removal. */
  nodes: { in: GainNode; out: GainNode; dry: GainNode; wet: GainNode } | null;
}

/** A gain between two consecutive points of the chain — the thing that fades
 *  when a route changes. */
interface Link { from: AudioNode; to: AudioNode; gain: GainNode }

type Step =
  | { kind: 'out'; slot: Slot }
  | { kind: 'in'; slot: Slot; at: number };

/**
 * Build an insert chain from `head` to `tail`, which start wired straight
 * through.
 *
 * A structural edit never swaps a connection instantly. A splice-in builds the
 * route through the new slot beside the old one and crossfades the two into
 * `next`; a splice-out does the reverse, so the effect's tail fades rather than
 * cuts. A move is a splice-out followed by a splice-in, never one rewire:
 * crossfading two orders at once would wire `b → c` and `c → b` together, and
 * Web Audio mutes a cycle with no delay in it.
 */
export function createInsertChain(
  ctx: BaseAudioContext,
  head: AudioNode,
  tail: AudioNode,
  opts: InsertChainOptions = {},
): OwnedInsertChain {
  const fadeMs = opts.fadeMs ?? 15;
  const timers: Timers = {
    setTimer: opts.setTimer ?? defaultTimers.setTimer,
    clearTimer: opts.clearTimer ?? defaultTimers.clearTimer,
  };
  const used = new WeakSet<InsertEffect>();
  const order: Slot[] = [];
  /** The slots the audio graph routes through, in graph order. */
  const live: Slot[] = [];
  const links: Link[] = [];
  let busy = false;
  let cancel: (() => void) | null = null;
  let disposed = false;
  let waiters: (() => void)[] = [];

  const fade = (): number => (ctx.state === 'running' ? fadeMs : 0);

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

  const setBypass = (s: Slot, ms: number): void => {
    if (!s.nodes) return;
    writeParam(ctx, s.nodes.wet.gain, s.bypassed ? 0 : 1, ms);
    writeParam(ctx, s.nodes.dry.gain, s.bypassed ? 1 : 0, ms);
  };

  const build = (s: Slot): void => {
    if (s.nodes) return;
    const n = {
      in: ctx.createGain(), out: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain(),
    };
    n.in.connect(s.effect.input);
    s.effect.output.connect(n.wet);
    n.wet.connect(n.out);
    n.in.connect(n.dry);
    n.dry.connect(n.out);
    s.nodes = n;
    n.wet.gain.value = s.bypassed ? 0 : 1;
    n.dry.gain.value = s.bypassed ? 1 : 0;
    setBypass(s, 0);
  };

  const destroy = (s: Slot): void => {
    const n = s.nodes;
    if (!n) return;
    // Targeted, not bare: the effect's nodes are the consumer's, and may be
    // wired to things besides this slot.
    n.in.disconnect();
    try { s.effect.output.disconnect(n.wet); } catch { /* already cut */ }
    n.wet.disconnect();
    n.dry.disconnect();
    n.out.disconnect();
    s.nodes = null;
  };

  const plan = (): Step | null => {
    const stale = live.find((s) => s.removed);
    if (stale) return { kind: 'out', slot: stale };
    const wanted = order.filter((s) => live.includes(s));
    for (let i = 0; i < wanted.length; i += 1) {
      // Out now, back in at its place on a later step.
      if (live[i] !== wanted[i]) return { kind: 'out', slot: wanted[i] };
    }
    const i = order.findIndex((s) => !live.includes(s));
    if (i < 0) return null;
    let at = 0;
    for (let j = i - 1; j >= 0; j -= 1) {
      const k = live.indexOf(order[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    return { kind: 'in', slot: order[i], at };
  };

  /** Start `step`'s crossfade and return what finishes it. */
  const begin = (step: Step, ms: number): (() => void) => {
    const s = step.slot;
    if (step.kind === 'in') {
      build(s);
      const prev = live[step.at - 1] ?? null;
      const next = live[step.at] ?? null;
      const old = find(outOf(prev), inOf(next));
      link(outOf(prev), inOf(s), 1);
      const incoming = link(outOf(s), inOf(next), 0);
      live.splice(step.at, 0, s);
      writeParam(ctx, old.gain.gain, 0, ms);
      writeParam(ctx, incoming.gain.gain, 1, ms);
      return () => unlink(old);
    }
    const i = live.indexOf(s);
    const prev = live[i - 1] ?? null;
    const next = live[i + 1] ?? null;
    const into = find(outOf(prev), inOf(s));
    const from = find(outOf(s), inOf(next));
    const direct = link(outOf(prev), inOf(next), 0);
    live.splice(i, 1);
    writeParam(ctx, from.gain.gain, 0, ms);
    writeParam(ctx, direct.gain.gain, 1, ms);
    return () => {
      unlink(into);
      unlink(from);
      if (s.removed) {
        destroy(s);
        s.effect.dispose?.();
      }
    };
  };

  const pump = (): void => {
    while (!busy && !disposed) {
      const step = plan();
      if (!step) {
        const done = waiters;
        waiters = [];
        for (const w of done) w();
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

  link(head, tail, 1);

  const slotOf = (effect: InsertEffect, bypassed: boolean): Slot => {
    const s: Slot = { effect, bypassed, removed: false, nodes: null, handle: null as never };
    s.handle = {
      effect,
      bypass(on) {
        if (s.bypassed === on) return;
        s.bypassed = on;
        setBypass(s, fade());
      },
      bypassed: () => s.bypassed,
      moveTo(index) {
        const from = order.indexOf(s);
        if (from < 0) return;
        order.splice(from, 1);
        order.splice(Math.max(0, Math.min(index, order.length)), 0, s);
        pump();
      },
      remove() {
        const at = order.indexOf(s);
        if (at < 0) return;
        order.splice(at, 1);
        s.removed = true;
        pump();
      },
      index: () => order.indexOf(s),
    };
    return s;
  };

  const chain: InsertChain = {
    add(effect, addOpts = {}) {
      if (used.has(effect)) {
        throw new Error('@weasel-js/audio: that effect is already in an insert slot');
      }
      used.add(effect);
      const s = slotOf(effect, addOpts.bypassed ?? false);
      const index = addOpts.index ?? order.length;
      order.splice(Math.max(0, Math.min(index, order.length)), 0, s);
      pump();
      return s.handle;
    },
    slots: () => order.map((s) => s.handle),
    clear() {
      for (const s of [...order]) s.handle.remove();
    },
    settled() {
      if (!busy && plan() === null) return Promise.resolve();
      return new Promise((resolve) => { waiters.push(resolve); });
    },
  };
  return {
    chain,
    dispose() {
      disposed = true;
      cancel?.();
      cancel = null;
    },
  };
}
