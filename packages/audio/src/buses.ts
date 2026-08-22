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
 * value whenever a solo changed it in between.
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

  const apply = (): void => {
    const soloing = anySoloed();
    for (const s of states.values()) {
      const audible = !s.muted && (!soloing || s.soloed);
      s.node.gain.value = audible ? s.gain : 0;
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
          if (rampMs && rampMs > 0) {
            s.node.gain.linearRampToValueAtTime?.(value, ctx.currentTime + rampMs / 1000);
          }
          apply();
        },
        mute(on) { s.muted = on; apply(); },
        solo(on) { s.soloed = on; apply(); },
      };
    },
  };
}
