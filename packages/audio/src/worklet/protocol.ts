import type { KernelNoise, KernelNote } from '../voiceKernel';

/** The name the voice processor registers under in an `AudioWorkletGlobalScope`. */
export const VOICE_PROCESSOR = 'weasel-voices';

/** What a voice starts with. Times are context seconds. */
interface VoiceStart {
  id: number;
  /** When the voice's first sample sounds. */
  at: number;
  level: number;
  pan: number;
  rate: number;
  detune: number;
}

/** What the engine posts to a bus's voice processor. Every time is context
 *  seconds, and one already past applies at the next render quantum. */
export type ToProcessor =
  | (VoiceStart & { kind: 'note'; patch: KernelNote })
  | (VoiceStart & { kind: 'noise'; patch: KernelNoise; seed: number })
  /** `end` 0 sets the level at once; otherwise it ramps there linearly, from
   *  wherever it is, by `end` — what `writeParam` does to a gain. */
  | { kind: 'level'; id: number; value: number; end: number }
  | { kind: 'pan'; id: number; value: number }
  | { kind: 'retune'; id: number; rate: number; detune: number }
  | { kind: 'release'; id: number }
  /** Silence the voice at `at`, or before it starts if that is earlier. */
  | { kind: 'stop'; id: number; at: number }
  | { kind: 'dispose' };

/** What a voice processor posts back: a voice has stopped making sound, for
 *  good — it played out, or reached its stop. */
export interface FromProcessor {
  kind: 'ended';
  id: number;
}
