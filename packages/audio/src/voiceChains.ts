import { writeParam } from './param';

/** A voice's level and pan, between its source and its bus. */
export interface Chain {
  gain: GainNode;
  panner: StereoPannerNode;
}

/** Chains handed from voice to voice, so a new voice does not build two nodes. */
export interface ChainPool {
  take(bus: AudioNode, gain: number, pan: number): Chain;
  /** Off its bus and back in the pool, while the pool has room. */
  give(chain: Chain): void;
  clear(): void;
}

export function createChainPool(ctx: BaseAudioContext, limit: number): ChainPool {
  // An idle chain is kept off its bus: still wired to the destination, it costs
  // the audio thread every render quantum whether or not anything sounds.
  const idle: Chain[] = [];
  return {
    take(bus, gain, pan) {
      let chain = idle.pop();
      if (!chain) {
        chain = { gain: ctx.createGain(), panner: ctx.createStereoPanner() };
        chain.panner.connect(chain.gain);
      }
      // Not a bare `.value`: a reused gain can still hold the last voice's fade.
      writeParam(ctx, chain.gain.gain, gain);
      chain.panner.pan.value = pan;
      chain.gain.connect(bus);
      return chain;
    },
    give(chain) {
      chain.gain.disconnect();
      if (idle.length < limit) idle.push(chain);
    },
    clear() { idle.length = 0; },
  };
}
