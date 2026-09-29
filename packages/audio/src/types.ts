import type { Envelope } from './envelope';
import type { Pitch } from './pitch';
import type { Vec2 } from './spatialize';
import type { StealPolicy } from './voicePool';

/** Options for `AudioEngine.play`. */
export interface PlayOptions {
  /** Default: the first configured bus. */
  bus?: string;
  /** 0..1, default 1. Multiplied by any spatialized gain. */
  gain?: number;
  /** Playback rate, default 1. */
  rate?: number;
  /** Detune in cents, default 0. */
  detune?: number;
  loop?: boolean;
  /** Explicit stereo pan, -1..1. Ignored when `position` is given. */
  pan?: number;
  /** World position; spatialized against the engine listener. */
  position?: Vec2;
  /** Engine time in ms (see `engine.now()`). Default: as soon as possible. */
  when?: number;
  /** `stopKey(key)` stops every voice sharing this key. */
  cancelKey?: string;
  onDone?: () => void;
}

/** Controls for one voice from `play()`. Safe to keep past the voice's end:
 *  every setter is then a no-op and `isPlaying()` is false. */
export interface VoiceHandle {
  id: number;
  /** `fadeMs` ramps the voice out and stops it at the end of the ramp. */
  stop(fadeMs?: number): void;
  /** Note-off: a synth voice runs its envelope's release from whatever level it
   *  has reached. A buffer voice has no envelope, so this is `stop()`. Either
   *  one released before it starts is canceled. */
  release(): void;
  setGain(value: number, rampMs?: number): void;
  /** Playback rate. Applies to a voice booked for a future `when` too. */
  setRate(value: number): void;
  /** Detune in cents. Applies to a voice booked for a future `when` too. */
  setDetune(cents: number): void;
  /** Explicit stereo pan. Stops the voice tracking a `position`. */
  setPan(value: number): void;
  setPosition(p: Vec2): void;
  isPlaying(): boolean;
}

/** An oscillator's waveform: one of Web Audio's built-in shapes, or the
 *  amplitudes of harmonic partials — `[1, 0.5, 0.25]` is the fundamental at
 *  full level, the second harmonic at half and the third at a quarter. Partials
 *  are normalized, so only their ratios matter. */
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | readonly number[];

/** A pitch sweep from the note's own pitch. */
export interface Glide {
  to: Pitch;
  /** Default: the note's `duration`, or 100 ms for a held note. */
  ms?: number;
  /** Default 'exponential', which moves evenly in pitch; 'linear' moves evenly
   *  in hertz. */
  curve?: 'linear' | 'exponential';
}

/** The timbre of a note, apart from its pitch — spread one into several
 *  `playNote` calls to reuse it. */
export interface SynthPatch {
  /** Default 'sine'. */
  wave?: Waveform;
  envelope?: Envelope;
  glide?: Glide;
}

/** Options for `AudioEngine.playNote`. Routing, level, position, timing and
 *  `cancelKey` mean what they mean for `play()`. */
export interface NoteOptions extends SynthPatch, Omit<PlayOptions, 'rate' | 'loop'> {
  pitch: Pitch;
  /** Gate length in ms: how long the note sounds before its release begins.
   *  Omit to hold it until `release()`. */
  duration?: number;
}

/** Options for `createAudioEngine`. */
export interface AudioEngineOptions {
  /** Injectable for tests and for consumers that own the context. */
  context?: AudioContext;
  /** Scheduling window in ms. Default 100. */
  lookahead?: number;
  /** Scheduler pass interval in ms. Default 25. */
  tickInterval?: number;
  /** Default ['sfx', 'music', 'ui']. */
  buses?: string[];
  /** Max concurrent voices PER BUS before stealing. Default 32. */
  voiceLimit?: number;
  /** Default 'oldest'. */
  steal?: StealPolicy;
  fetchFn?: typeof fetch;
  /** One-shot timer that wakes each scheduler pass. Default: `createTickTimer()`,
   *  a Worker-backed timer that survives a hidden tab. Injecting either half
   *  replaces the default, and the missing half falls back to `setTimeout`'s. */
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}
