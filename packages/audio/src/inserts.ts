import { defaultTimers, type Timers } from './audioTime';
import { nextStep } from './insertPlan';
import { createInsertPump } from './insertPump';
import { createInsertRoute } from './insertRoute';
import { retireSlot, writeBypass, type Slot } from './insertSlot';

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

/** Where `InsertChain.add` puts an effect, and whether it starts bypassed. */
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
  /** Throws once the bus graph is disposed. */
  add(effect: InsertEffect, opts?: InsertAddOptions): InsertSlot;
  slots(): InsertSlot[];
  clear(): void;
  settled(): Promise<void>;
}

/** Options for an insert chain: its crossfade length, and the timers it schedules with. */
export interface InsertChainOptions extends Partial<Timers> {
  /** Crossfade length for every edit, in ms. Default 15. */
  fadeMs?: number;
}

/** A chain and the switch that takes every effect out at once, as `BusGraph.dispose` does. */
export interface OwnedInsertChain {
  chain: InsertChain;
  dispose(): void;
}

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
  let disposed = false;

  const fade = (): number => (ctx.state === 'running' ? fadeMs : 0);
  const route = createInsertRoute(ctx, head, tail);
  const { pump, settled, stop, release } = createInsertPump(
    ctx, timers, fade, () => nextStep(order, route.live), route.begin,
  );

  const slotOf = (effect: InsertEffect, bypassed: boolean): Slot => {
    const s: Slot = { effect, bypassed, removed: false, nodes: null, handle: null as never };
    s.handle = {
      effect,
      bypass(on) {
        if (s.bypassed === on) return;
        s.bypassed = on;
        writeBypass(ctx, s, fade());
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
        // `nextStep` only finds a removed slot in the graph; one that is out of it has no later step to dispose it.
        if (!route.holds(s)) retireSlot(s);
        pump();
      },
      index: () => order.indexOf(s),
    };
    return s;
  };

  const chain: InsertChain = {
    add(effect, addOpts = {}) {
      if (disposed || used.has(effect)) {
        throw new Error(`@weasel-js/audio: ${disposed ? 'the insert chain is disposed' : 'that effect is already in an insert slot'}`);
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
    settled,
  };
  return {
    chain,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      // No fade: every slot, a leaving one included, goes at once.
      const held = route.drop();
      const gone = new Set([...held.live, ...order, ...(held.leaving ? [held.leaving] : [])]);
      order.length = 0;
      for (const s of gone) retireSlot(s);
      release();
    },
  };
}
