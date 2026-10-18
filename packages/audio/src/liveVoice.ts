import type { Vec2 } from './spatialize';
import type { PlayOptions, VoiceDropReason } from './types';
import type { VoicePool } from './voicePool';
import type { Chain } from './voiceChains';

/** A voice pool and its token index. Tokens restart at 1 in every pool, so the
 *  index has to be per pool — keyed by bus name, a shared pool would look a
 *  steal victim up under the wrong name and silently never tear it down. */
export interface Slots {
  pool: VoicePool;
  byToken: Map<number, LiveVoice>;
}

/** What `play` and `playNote` share apart from the node they make. */
export type VoiceOptions = Omit<PlayOptions, 'loop'>;

/** What a voice plays through: a scheduled source node, or a stand-in with
 *  the same end-of-life contract — `onended` fires asynchronously, once. */
export type SourceLike = Pick<AudioScheduledSourceNode, 'onended' | 'stop' | 'disconnect'>;

/** Several sources stopped together, as one: the first carries `onended`. */
export const sourceGroup = (nodes: AudioScheduledSourceNode[]): SourceLike => ({
  get onended() { return nodes[0].onended; },
  set onended(fn) { nodes[0].onended = fn; },
  stop(when?: number) {
    for (const n of nodes) {
      try { n.stop(when); } catch { /* not started, or already stopped */ }
    }
  },
  disconnect() { for (const n of nodes) n.disconnect(); },
});

/** How one kind of voice makes its node. */
export interface Starter {
  /** False drops the voice when it comes due. */
  ready(): boolean;
  /** Build the node, connect it into `voice.chain.panner`, and start it at
   *  `when`, engine ms. */
  start(voice: LiveVoice, when: number): SourceLike;
}

export interface LiveVoice {
  id: number;
  slots: Slots;
  /** Null until the scheduler fires it: a voice booked seconds out must not
   *  hold a slot, and must not be an eviction candidate, while silent. */
  slot: number | null;
  token: number;
  key?: string;
  onDrop?: (reason: VoiceDropReason) => void;
  source: SourceLike | null;
  /** A synth voice's envelope gain, between its sources and the chain. */
  env: GainNode | null;
  /** Writes `rate` and `detune` to the node, once there is one. */
  retune: (() => void) | null;
  /** A synth voice's note-off. Null for a buffer voice, and until it starts. */
  release: (() => void) | null;
  releasing: boolean;
  /** Null once torn down, when the chain goes back to be reused: a handle
   *  that outlives its voice must not write to another voice's nodes. */
  chain: Chain | null;
  baseGain: number;
  spatialGain: number;
  rate: number;
  detune: number;
  /** Kept so `setListener` can re-spatialize a voice that is already playing. */
  position?: Vec2;
  playing: boolean;
  canceled: boolean;
  /** `stop(fadeMs)` owns the chain gain from here until the source ends. */
  fading: boolean;
  /** Context time a `setGain` ramp on the chain gain ends at; 0 when none was asked for. */
  rampEnd: number;
}
