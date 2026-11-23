import {
  createInsertChain, type InsertChain, type InsertChainOptions, type OwnedInsertChain,
} from './inserts';
import { checkGain, writeParam } from './param';

/** Controls for one named bus. `rampMs` slews a gain change over that many
 *  ms instead of stepping it. */
export interface BusHandle {
  /** Throws a `RangeError` on a value or ramp that is not finite. */
  setGain(value: number, rampMs?: number): void;
  mute(on: boolean): void;
  solo(on: boolean): void;
  /** The bus's own gain, as last set — not what a mute or solo is imposing. */
  gain(): number;
  /** The mute flag as set, independent of any solo. */
  muted(): boolean;
  /** The solo flag as set; whether it silences anything is a graph-wide answer. */
  soloed(): boolean;
  /** Whether the bus is being heard: unmuted, and soloed if any bus is soloed.
   *  Not derivable from `muted()` and `soloed()` alone. */
  audible(): boolean;
  /** Effects between where the bus's voices connect and its fader. */
  readonly inserts: InsertChain;
}

/** The mix graph built by `createBusGraph`. `input(name)` is where a voice
 *  connects; it runs through the bus's inserts to `node(name)`, the fader,
 *  which feeds `master`, which feeds the destination. Unknown bus names throw. */
export interface BusGraph {
  master: GainNode;
  input(name: string): GainNode;
  node(name: string): GainNode;
  bus(name: string): BusHandle;
  names(): string[];
  /** Cancel every insert transition in flight and take every insert out at
   *  once, calling its `dispose`. Each bus's input is left wired straight to
   *  its fader. */
  dispose(): void;
}

/** Options for `createBusGraph`: the insert chains' crossfade and timer. */
export type BusGraphOptions = InsertChainOptions;

interface BusState {
  input: GainNode;
  node: GainNode;
  inserts: OwnedInsertChain;
  gain: number;
  muted: boolean;
  soloed: boolean;
  /** The value last written to the fader. */
  written: number;
  /** When the bus's own `setGain` ramp ends, in context time; 0 for none. */
  rampEnd: number;
}

/** Throws unless `names` holds at least one bus and no name twice. */
export function checkBusNames(names: readonly string[]): void {
  if (names.length === 0) {
    throw new Error('@weasel-js/audio: an engine needs at least one bus');
  }
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`@weasel-js/audio: bus "${name}" is named twice`);
    seen.add(name);
  }
}

/**
 * The mix graph: one `GainNode` per named bus, all routed to a master that
 * routes to the destination.
 *
 * Gain, mute and solo are three inputs to one output value rather than three
 * things that write the node directly — otherwise unmuting restores the wrong
 * value whenever a solo changed it in between. All three write through
 * `writeParam`, so `rampMs` survives instead of being overwritten by the
 * recomputation that follows it.
 */
export function createBusGraph(
  ctx: AudioContext,
  names: string[],
  opts: BusGraphOptions = {},
): BusGraph {
  checkBusNames(names);
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const states = new Map<string, BusState>();
  for (const name of names) {
    const input = ctx.createGain();
    const node = ctx.createGain();
    node.connect(master);
    const inserts = createInsertChain(ctx, input, node, opts);
    states.set(name, { input, node, inserts, gain: 1, muted: false, soloed: false, written: node.gain.value, rampEnd: 0 });
  }

  const anySoloed = (): boolean => {
    for (const s of states.values()) if (s.soloed) return true;
    return false;
  };

  const audibleUnder = (s: BusState, soloing: boolean): boolean =>
    !s.muted && (!soloing || s.soloed);

  // `own` names the one bus whose own value was set, so a solo does not slew
  // every other bus at whatever rate that bus was last set with. Any other bus
  // whose value did not change is not written, since a write cancels its ramp in
  // flight; one that is heard again resumes its own ramp to the same end.
  const apply = (own?: { bus: BusState; ms?: number }): void => {
    const soloing = anySoloed();
    const now = ctx.currentTime;
    for (const s of states.values()) {
      const audible = audibleUnder(s, soloing);
      const value = audible ? s.gain : 0;
      let ms: number | undefined;
      if (own?.bus === s) {
        ms = own.ms && own.ms > 0 ? own.ms : undefined;
        s.rampEnd = ms ? now + ms / 1000 : 0;
      } else if (value === s.written) {
        continue;
      } else if (audible) {
        const left = (s.rampEnd - now) * 1000;
        if (left > 0) ms = left;
      }
      s.written = value;
      writeParam(ctx, s.node.gain, value, ms);
    }
  };

  const get = (name: string): BusState => {
    const s = states.get(name);
    if (!s) throw new Error(`@weasel-js/audio: unknown bus "${name}"`);
    return s;
  };

  return {
    master,
    input: (name) => get(name).input,
    node: (name) => get(name).node,
    names: () => [...states.keys()],
    dispose() {
      for (const s of states.values()) s.inserts.dispose();
    },
    bus(name) {
      const s = get(name);
      return {
        setGain(value, rampMs) {
          checkGain('bus', value, rampMs);
          s.gain = value;
          apply({ bus: s, ms: rampMs });
        },
        mute(on) { s.muted = on; apply(); },
        solo(on) { s.soloed = on; apply(); },
        gain: () => s.gain,
        muted: () => s.muted,
        soloed: () => s.soloed,
        audible: () => audibleUnder(s, anySoloed()),
        inserts: s.inserts.chain,
      };
    },
  };
}
