import { writeParam } from './param';

/** Where a voice's level and pan are applied, between its source and its bus. */
export interface VoiceOut {
  /** What a node voice's source connects into. Null for a voice whose samples
   *  are made off the main thread, which has no node of its own. */
  readonly input: AudioNode | null;
  /** The level at once, or a linear ramp to it ending `rampMs` from now,
   *  from wherever it is — `writeParam`'s semantics. */
  level(value: number, rampMs?: number): void;
  pan(value: number): void;
  /** Done with, and free to be reused. */
  free(): void;
  /** Off its bus and never reused: something half-built is still wired into it. */
  abandon(): void;
}

/** A gain and a stereo panner per voice, handed from voice to voice so a new
 *  voice does not build two nodes. */
export interface ChainPool {
  take(bus: AudioNode, gain: number, pan: number): VoiceOut;
  clear(): void;
}

interface Chain {
  gain: GainNode;
  panner: StereoPannerNode;
}

export function createChainPool(ctx: BaseAudioContext, limit: number): ChainPool {
  // An idle chain is kept off its bus: still wired to the destination, it costs
  // the audio thread every render quantum whether or not anything sounds.
  const idle: Chain[] = [];
  const newChain = (): Chain => {
    const chain = { gain: ctx.createGain(), panner: ctx.createStereoPanner() };
    chain.panner.connect(chain.gain);
    return chain;
  };
  return {
    take(bus, gain, pan) {
      const chain = idle.pop() ?? newChain();
      const { gain: amp, panner } = chain;
      // Not a bare `.value`: a reused gain can still hold the last voice's fade.
      writeParam(ctx, amp.gain, gain);
      panner.pan.value = pan;
      amp.connect(bus);
      let held = true;
      return {
        input: panner,
        level: (value, rampMs) => writeParam(ctx, amp.gain, value, rampMs),
        pan: (value) => { panner.pan.value = value; },
        free() {
          if (!held) return;
          held = false;
          amp.disconnect();
          if (idle.length < limit) idle.push(chain);
        },
        abandon() {
          held = false;
          amp.disconnect();
        },
      };
    },
    clear() { idle.length = 0; },
  };
}
