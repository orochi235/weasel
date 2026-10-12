import type { AudioEngine } from './createAudioEngine';
import type { SoundHandle } from './soundCache';
import type { NoiseOptions, NoteOptions, PlayOptions, VoiceHandle } from './types';

/** A synth note on a step. `length` is its gate in steps, default 1.
 *
 *  Any event's `step` may be fractional: it is booked with the step it sits in
 *  and sounds that fraction of a step later, so `2.5` is halfway from step 2 to
 *  step 3. That is swing, a flam, or a hit that drags. */
export interface PatternNote extends Omit<NoteOptions, 'when' | 'duration'> {
  step: number;
  length?: number;
}

/** Noise on a step: a hi-hat, a snare's rattle. `length` is its gate in steps,
 *  default 1. */
export interface PatternNoise extends Omit<NoiseOptions, 'when' | 'duration'> {
  step: number;
  length?: number;
}

/** A buffer played on a step: a drum hit, a sample. */
export interface PatternHit extends Omit<PlayOptions, 'when'> {
  step: number;
  sound: SoundHandle;
}

/** Anything a pattern plays on a step. */
export type PatternEvent = PatternNote | PatternNoise | PatternHit;

/** Options for `createPatternPlayer`. */
export interface PatternPlayerOptions {
  /** Beats per minute. */
  tempo: number;
  /** Steps per beat. Default 4, so a step is a sixteenth note in 4/4. */
  stepsPerBeat?: number;
  events?: readonly PatternEvent[];
  /** Steps in one pass. Default: through the last event, rounded up to a whole
   *  beat. */
  length?: number;
  /** Default true. */
  loop?: boolean;
  /** Cents added to every event's own `detune`: a number, or a function of
   *  the event's `step`, for a pattern that drifts in pitch as it plays. A
   *  function is asked as each event is booked. Default 0. */
  detune?: PatternDetune;
  /** Called as each step is booked — up to a lookahead ahead of it sounding —
   *  with its index in the pattern and its engine time in ms. */
  onStep?: (step: number, when: number) => void;
}

/** See `PatternPlayerOptions.detune`. */
export type PatternDetune = number | ((step: number) => number);

/** A running sequence of steps. See `createPatternPlayer`. */
export interface PatternPlayer {
  /** Start from step 0 at engine time `when`, default now. No-op while playing. */
  start(when?: number): void;
  /** Book nothing further, and release every voice the player started. */
  stop(): void;
  playing(): boolean;
  tempo(): number;
  /** Takes effect from the next step not yet booked. Called from `onStep`,
   *  that is the step after the one reported, which keeps its own length. */
  setTempo(bpm: number): void;
  /** Takes effect from the next step not yet booked. */
  setDetune(detune: PatternDetune): void;
  /** Takes effect from the next step not yet booked. */
  setEvents(events: readonly PatternEvent[], length?: number): void;
}

let nextPlayer = 1;

/** Steps in one pass of `events` when no length is given: through the last
 *  event, rounded up to a whole beat. */
export function patternLength(events: readonly PatternEvent[], stepsPerBeat = 4): number {
  let last = -1;
  for (const e of events) last = Math.max(last, Math.floor(e.step));
  return Math.max(1, Math.ceil((last + 1) / stepsPerBeat)) * stepsPerBeat;
}

const checkTempo = (bpm: number): void => {
  if (!(bpm > 0) || !Number.isFinite(bpm)) {
    throw new RangeError(`@weasel-js/audio: tempo must be a positive number of bpm, got ${bpm}`);
  }
};

/**
 * A step sequencer over `engine`. Each step is one `engine.schedule` booking;
 * when it fires, it books that step's events at the step's exact time and then
 * books the step after it. So nothing is booked further ahead than the
 * scheduler's lookahead, which is what lets a tempo change or new events land
 * on the very next step.
 *
 * A step that fires more than a step late — a stalled timer, a suspended
 * context — skips to the next step still ahead of the clock, keeping phase,
 * rather than playing the missed ones at once.
 */
export function createPatternPlayer(engine: AudioEngine, opts: PatternPlayerOptions): PatternPlayer {
  checkTempo(opts.tempo);
  const stepsPerBeat = opts.stepsPerBeat ?? 4;
  const loop = opts.loop ?? true;
  const key = `\u0000pattern:${nextPlayer++}`;

  let bpm = opts.tempo;
  let drift = opts.detune ?? 0;
  let length = 1;
  let byStep = new Map<number, PatternEvent[]>();
  const setEvents = (events: readonly PatternEvent[], len?: number): void => {
    byStep = new Map();
    for (const e of events) {
      const step = Math.floor(e.step);
      const list = byStep.get(step);
      if (list) list.push(e);
      else byStep.set(step, [e]);
    }
    length = len ?? patternLength(events, stepsPerBeat);
  };
  setEvents(opts.events ?? [], opts.length);

  let running = false;
  let inStep = false;
  /** Steps booked since `start`, not wrapped. */
  let count = 0;
  let lastAt: number | null = null;
  let nextAt = 0;
  const voices = new Set<VoiceHandle>();

  const stepMs = (): number => 60_000 / bpm / stepsPerBeat;

  const book = (): void => { engine.schedule(nextAt, fire, key); };

  const fire = (scheduled: number): void => {
    if (!running) return;
    let when = scheduled;
    const behind = engine.now() - when;
    if (behind > stepMs()) {
      const skip = Math.ceil(behind / stepMs());
      count += skip;
      when += skip * stepMs();
    }
    if (!loop && count >= length) {
      running = false;
      return;
    }
    const step = count % length;
    for (const v of voices) if (!v.isPlaying()) voices.delete(v);
    for (const e of byStep.get(step) ?? []) {
      const at = when + (e.step - step) * stepMs();
      const detune = (e.detune ?? 0) + (typeof drift === 'function' ? drift(e.step) : drift);
      if ('sound' in e) {
        const { step: _s, sound, ...play } = e;
        voices.add(engine.play(sound, { ...play, detune, when: at }));
      } else if ('noise' in e) {
        const { step: _s, length: steps = 1, ...noise } = e;
        voices.add(engine.playNoise({ ...noise, detune, when: at, duration: steps * stepMs() }));
      } else {
        const { step: _s, length: steps = 1, ...note } = e;
        voices.add(engine.playNote({ ...note, detune, when: at, duration: steps * stepMs() }));
      }
    }
    // Read before `onStep`: a tempo set there starts with the next step, and
    // this one keeps the length its events were gated by.
    const ms = stepMs();
    inStep = true;
    try {
      opts.onStep?.(step, when);
    } finally {
      inStep = false;
    }
    if (!running) return;
    count += 1;
    lastAt = when;
    nextAt = when + ms;
    book();
  };

  return {
    start(when) {
      if (running) return;
      running = true;
      count = 0;
      lastAt = null;
      nextAt = when ?? engine.now();
      book();
    },
    stop() {
      if (!running) return;
      running = false;
      engine.stopKey(key);
      for (const v of voices) v.release();
      voices.clear();
    },
    playing: () => running,
    tempo: () => bpm,
    setTempo(next) {
      checkTempo(next);
      bpm = next;
      // From inside `onStep` the step after this one is about to be booked.
      if (!running || lastAt === null || inStep) return;
      engine.stopKey(key);
      nextAt = Math.max(lastAt + stepMs(), engine.now());
      book();
    },
    setDetune(next) { drift = next; },
    setEvents,
  };
}
