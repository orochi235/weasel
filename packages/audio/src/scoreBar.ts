import type { Envelope } from './envelope';
import type { PatternNote } from './patternPlayer';
import { scoreModes, type ScoreParams } from './scoreMood';

/** Steps in a bar of score: sixteenths in 4/4. */
export const SCORE_BAR_STEPS = 16;

/** How `scoreBar` places and routes its notes. */
export interface ScoreBarOptions {
  /** Semitones above C for the tonic. Default 0. */
  tonic?: number;
  /** Default: the engine's first bus. */
  bus?: string;
  /** The level the notes sounding on one step add up to at most. Default 0.5. */
  gain?: number;
  /** Chooses the order an ostinato takes a chord's tones in. Default: rising. */
  seed?: number;
}

/** Scale degrees a progression takes its roots from, a chord at a time. */
const PROGRESSION = [0, 5, 3, 4];

/**
 * The chord a score plays, as MIDI notes, root first. `chord` counts chords
 * since the score began; a cluster stays on the tonic, and the other harmonies
 * walk a four-chord progression inside the mode.
 */
export function scoreChord(params: ScoreParams, chord: number, tonic = 0): number[] {
  const scale = scoreModes[params.mode];
  const tone = (degree: number): number =>
    params.register + tonic + scale[degree % 7] + 12 * Math.floor(degree / 7);
  if (params.harmony === 'cluster') {
    const root = tone(0);
    return [root, root + 1, root + 6];
  }
  const degree = PROGRESSION[chord % PROGRESSION.length];
  const root = tone(degree);
  if (params.harmony === 'quartal') return [root, root + 7, root + 12, root + 17];
  if (params.spread < 2) return [root, tone(degree + 2), tone(degree + 4)];
  const open = [root, tone(degree + 4), tone(degree + 2) + 12];
  // The fourth above the root, two octaves up: on a Lydian tonic, the raised
  // fourth the mode is heard by.
  if (params.spread >= 3) open.push(tone(degree + 3) + 24);
  return open;
}

/** The order an ostinato takes `count` chord tones in. */
function figure(count: number, seed: number | undefined): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (seed === undefined) return order;
  let state = (seed >>> 0) || 1;
  for (let i = count - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const PLUCK: Envelope = { attack: 5, decay: 140, sustain: 0.2, release: 80 };

/**
 * One bar of score as pattern events, for a player `SCORE_BAR_STEPS` long.
 * `bar` counts bars since the score began: it picks the chord, by the harmonic
 * rhythm, and how many layers a pulsed score has built up to, one more every
 * two bars. The same arguments always write the same bar.
 *
 * With no pulse, the bar is its chord held throughout. With one, the layers
 * are an ostinato over the chord's tones, a bass on the root, the ostinato
 * doubled an octave up on the off pulses, and the chord held as a pad.
 */
export function scoreBar(params: ScoreParams, bar: number, opts: ScoreBarOptions = {}): PatternNote[] {
  const gain = opts.gain ?? 0.5;
  const chord = scoreChord(params, Math.floor(bar / params.harmonicRhythm), opts.tonic);
  const swell: Envelope = { attack: params.attack, release: params.attack };
  const held = params.articulation === 'sustained';
  const note = (step: number, length: number, midi: number, level: number, envelope: Envelope): PatternNote => ({
    step, length, pitch: { midi }, gain: gain * level, envelope,
    wave: held ? 'sine' : 'triangle',
    ...(opts.bus === undefined ? {} : { bus: opts.bus }),
  });
  const pad = (level: number, envelope: Envelope): PatternNote[] =>
    chord.map((midi) => note(0, SCORE_BAR_STEPS, midi, level / chord.length, envelope));

  if (params.density === 0) return pad(1, swell);

  const layers = Math.min(params.layers, 1 + Math.floor(bar / 2));
  const every = 4 / params.density;
  const order = figure(chord.length, opts.seed);
  const envelope = held ? swell : PLUCK;
  const events: PatternNote[] = [];
  for (let pulse = 0; pulse * every < SCORE_BAR_STEPS; pulse++) {
    const midi = chord[order[pulse % order.length]];
    events.push(note(pulse * every, every, midi, 0.4, envelope));
    if (layers >= 3 && pulse % 2 === 1) events.push(note(pulse * every, every, midi + 12, 0.15, envelope));
  }
  if (layers >= 2) {
    for (const step of [0, 8]) events.push(note(step, 8, chord[0] - 12, 0.3, { attack: 5, release: 120 }));
  }
  if (layers >= 4) events.push(...pad(0.15, { attack: 120, release: 200 }));
  return events;
}
