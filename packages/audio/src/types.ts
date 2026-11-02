import type { Envelope } from './envelope';
import type { Pitch } from './pitch';
import type { SpatialPoint } from './spatialize';
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
  position?: SpatialPoint;
  /** Engine time in ms (see `engine.now()`). Default: as soon as possible. */
  when?: number;
  /** `stopKey(key)` stops every voice sharing this key. */
  cancelKey?: string;
  /** The voice's source ended: it played out, or was stopped, faded, released
   *  or stolen after it started. */
  onDone?: () => void;
  /** The voice never got a source, so `onDone` will not be called. Called
   *  after `play()` has returned, never from inside it. */
  onDrop?: (reason: VoiceDropReason) => void;
}

/**
 * Why a voice never played:
 *
 * - `locked` — the context was not running when it was played.
 * - `disposed` — the engine was disposed, before the play or while it waited.
 * - `stopped` — stopped, released or `stopKey`ed before it came due.
 * - `unready` — its sound was not loaded in this engine when it came due.
 * - `failed` — its node threw as it started.
 * - `stale` — it came due while the context was suspended.
 */
export type VoiceDropReason = 'locked' | 'disposed' | 'stopped' | 'unready' | 'failed' | 'stale';

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
  setPosition(p: SpatialPoint): void;
  isPlaying(): boolean;
}

/** One sine partial of an inharmonic voice. */
export interface SynthPartial {
  /** Frequency as a multiple of the note's pitch. Any positive number: this is
   *  what reaches off the harmonic series. */
  ratio: number;
  /** Relative level, default 1. The voice's partials are scaled so their levels
   *  sum to 1, so the peak cannot pass the note's gain. */
  gain?: number;
  /** Exponential decay time constant in ms: the partial falls to 1/e of its
   *  level every `decay` ms, under the note's envelope. Omit to hold it. */
  decay?: number;
}

/** A voice built from sine oscillators at arbitrary ratios of the pitch, each
 *  with its own level and decay: a bell, a bar, struck metal. */
export interface Inharmonic {
  partials: readonly SynthPartial[];
}

/** An oscillator's waveform: one of Web Audio's built-in shapes; the
 *  amplitudes of harmonic partials — `[1, 0.5, 0.25]` is the fundamental at
 *  full level, the second harmonic at half and the third at a quarter, normalized
 *  so only their ratios matter; or `{ partials }`, sines at any ratio. */
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | readonly number[] | Inharmonic;

/** A `BiquadFilterNode` inside a synth voice, ahead of its amplitude envelope,
 *  with an envelope of its own on the cutoff. */
export interface VoiceFilter {
  /** Default 'lowpass'. */
  type?: BiquadFilterType;
  /** Cutoff or center in Hz, where the frequency envelope starts and ends. */
  frequency: number;
  /** Default 1. */
  Q?: number;
  /** dB, for the shelf and peaking types. */
  gain?: number;
  /** Shapes the cutoff: it sits at `frequency + amount × level`, `level` being
   *  this envelope's 0..1. It shares the note's gate and is released with it.
   *  A thump is a lowpass with a positive `amount` and a short decay to
   *  `sustain: 0`. Default: the cutoff holds at `frequency`. */
  envelope?: Envelope;
  /** Hz added at the envelope's peak; negative sweeps the cutoff down. Default 0. */
  amount?: number;
}

/** The three noise colors: white is flat, pink falls 3 dB an octave, brown 6. */
export type NoiseColor = 'white' | 'pink' | 'brown';

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
  filter?: VoiceFilter;
}

/** Options for `AudioEngine.playNote`. Routing, level, position, timing and
 *  `cancelKey` mean what they mean for `play()`. */
export interface NoteOptions extends SynthPatch, Omit<PlayOptions, 'rate' | 'loop'> {
  pitch: Pitch;
  /** Gate length in ms: how long the note sounds before its release begins.
   *  Omit to hold it until `release()`. */
  duration?: number;
}

/** The timbre of a noise voice — spread one into several `playNoise` calls to
 *  reuse it. */
export interface NoisePatch {
  noise: NoiseColor;
  envelope?: Envelope;
  filter?: VoiceFilter;
}

/** Options for `AudioEngine.playNoise`. Everything but the source means what it
 *  means for `playNote`; `rate` and `detune` retune the looping noise buffer,
 *  which shifts a pink or brown noise's color, and leave the filter where it is. */
export interface NoiseOptions extends NoisePatch, Omit<PlayOptions, 'loop'> {
  /** Gate length in ms. Omit to hold the noise until `release()`. */
  duration?: number;
}

/**
 * Options for `AudioEngine.stream`. Routing, level, position, `rate`, `loop`,
 * `cancelKey` and `onDone` mean what they mean for `play()`, with these
 * differences, all from playing through a media element rather than a buffer:
 *
 * - No `when`: the element starts once it has buffered enough, which is not
 *   sample-accurate and cannot be booked against the audio clock.
 * - No `detune`, and `setDetune` does nothing. `rate` is the element's
 *   `playbackRate`, which keeps pitch unless the element's `preservesPitch`
 *   is false.
 * - The stream counts toward its bus's voice limit and can be stolen like any
 *   voice — give music a bus of its own.
 */
export interface StreamOptions extends Omit<PlayOptions, 'when' | 'detune'> {
  /** Where to start, in ms into the media. Default: wherever the element is. */
  offset?: number;
  /** Set on an element made from a URL. A cross-origin URL needs CORS and
   *  `'anonymous'`, or the graph receives silence. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
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
  /** A voice or an `engine.schedule` callback came due `lateMs` after its
   *  time `when`, both in engine ms: the main thread stalled for longer than
   *  the lookahead covers, and the voice sounded late by that much. A
   *  `synthVoices: 'worklet'` voice is never reported: it was not late. */
  onLate?: (lateMs: number, when: number) => void;
  /** Crossfade for every insert-chain edit and bypass, in ms. Default 15. */
  insertFadeMs?: number;
  /** Uniform in [0, 1), for where in its loop a noise voice starts. Default `Math.random`. */
  random?: () => number;
  /**
   * Where `playNote` and `playNoise` make their samples. Default `'nodes'`:
   * oscillator and buffer nodes, built when the scheduler fires, so a main
   * thread stalled past the lookahead starts the voice late. `'worklet'`
   * renders them in an `AudioWorkletProcessor` from events posted at the
   * call, so a voice played ahead of a stall still starts on time. Its handle,
   * bus pool, stealing, pan and position behave as a node voice's do.
   *
   * The processor loads from a `blob:` URL, which a CSP must allow under
   * `script-src`. Until it has loaded — `unlock()` waits for it — and on a
   * context with no `audioWorklet`, synth voices play on nodes.
   */
  synthVoices?: 'nodes' | 'worklet';
}
