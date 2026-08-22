import { writeParam } from './param';

export interface BusHandle {
  setGain(value: number, rampMs?: number): void;
  mute(on: boolean): void;
  solo(on: boolean): void;
}

export interface BusGraph {
  master: GainNode;
  node(name: string): GainNode;
  bus(name: string): BusHandle;
  names(): string[];
}

interface BusState { node: GainNode; gain: number; muted: boolean; soloed: boolean }

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
export function createBusGraph(ctx: AudioContext, names: string[]): BusGraph {
  const master = ctx.createGain();
  master.connect(ctx.destination);

  const states = new Map<string, BusState>();
  for (const name of names) {
    const node = ctx.createGain();
    node.connect(master);
    states.set(name, { node, gain: 1, muted: false, soloed: false });
  }

  const anySoloed = (): boolean => {
    for (const s of states.values()) if (s.soloed) return true;
    return false;
  };

  // `ramp` names the one bus whose own value changed, so a solo does not slew
  // every other bus at whatever rate that bus was last set with.
  const apply = (ramp?: { bus: BusState; ms: number }): void => {
    const soloing = anySoloed();
    for (const s of states.values()) {
      const audible = !s.muted && (!soloing || s.soloed);
      writeParam(ctx, s.node.gain, audible ? s.gain : 0, ramp?.bus === s ? ramp.ms : undefined);
    }
  };

  const get = (name: string): BusState => {
    const s = states.get(name);
    if (!s) throw new Error(`@weasel-js/audio: unknown bus "${name}"`);
    return s;
  };

  return {
    master,
    node: (name) => get(name).node,
    names: () => [...states.keys()],
    bus(name) {
      const s = get(name);
      return {
        setGain(value, rampMs) {
          s.gain = value;
          apply(rampMs && rampMs > 0 ? { bus: s, ms: rampMs } : undefined);
        },
        mute(on) { s.muted = on; apply(); },
        solo(on) { s.soloed = on; apply(); },
      };
    },
  };
}
