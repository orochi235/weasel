import type { AudioEngine } from './createAudioEngine';
import { createPatternPlayer } from './patternPlayer';
import { SCORE_BAR_STEPS, scoreBar, type ScoreBarOptions } from './scoreBar';
import {
  readScoreCue, scoreParams, type ScoreCueReading, type ScoreMood, type ScoreParams,
} from './scoreMood';

/** What a score is playing in one bar, and why: the mood it was given, the cue
 *  that mood applies, and the parameters the bar was written from. */
export interface ScoreState {
  /** Bars since `start`. */
  bar: number;
  /** Bars since the cue last changed, which is what a pulsed score's layers
   *  build up from. */
  cueBar: number;
  mood: ScoreMood;
  cue: ScoreCueReading;
  params: ScoreParams;
}

/** Options for `createScore`. */
export interface ScoreOptions extends ScoreBarOptions {
  mood: ScoreMood;
  /** Called as each bar's first step is booked — up to a lookahead before it
   *  sounds — with what the bar plays and its engine time in ms. */
  onBar?: (state: ScoreState, when: number) => void;
}

/** A running generative score. See `createScore`. */
export interface Score {
  /** Start from bar 0 at engine time `when`, default now. No-op while playing. */
  start(when?: number): void;
  /** Book nothing further, and release every voice the score started. */
  stop(): void;
  playing(): boolean;
  /** The mood last set, which the next bar will take. */
  mood(): ScoreMood;
  /** Takes effect at the next bar line. */
  setMood(mood: ScoreMood): void;
  /** The bar most recently booked. */
  state(): ScoreState;
}

/**
 * Music written continuously from a mood rather than chosen from clips. Each
 * bar is `scoreBar` of the mood's `scoreParams`, booked through a pattern
 * player, and a new mood lands on the next bar line with its tempo.
 *
 * These devices work on a listener without asking them, which is what they are
 * for. `state()` and `onBar` name the cue in force and every parameter behind
 * it, so a consumer can show what is being applied as well as play it.
 */
export function createScore(engine: AudioEngine, opts: ScoreOptions): Score {
  const { mood: initial, onBar, ...barOpts } = opts;
  let target = initial;

  const stateAt = (bar: number, before: ScoreState | null): ScoreState => {
    const cue = readScoreCue(target);
    return {
      bar,
      cueBar: before && before.cue.name === cue.name ? before.cueBar + 1 : 0,
      mood: target,
      cue,
      params: scoreParams(target),
    };
  };
  const eventsOf = (state: ScoreState) => scoreBar(state.params, state.cueBar, barOpts);

  let current = stateAt(0, null);
  let next = current;

  const player = createPatternPlayer(engine, {
    tempo: current.params.tempo,
    length: SCORE_BAR_STEPS,
    events: eventsOf(current),
    onStep(step, when) {
      if (step === 0) {
        current = next;
        onBar?.(current, when);
      }
      if (step !== SCORE_BAR_STEPS - 1) return;
      next = stateAt(current.bar + 1, current);
      player.setTempo(next.params.tempo);
      player.setEvents(eventsOf(next), SCORE_BAR_STEPS);
    },
  });

  return {
    start(when) {
      if (player.playing()) return;
      current = next = stateAt(0, null);
      player.setTempo(current.params.tempo);
      player.setEvents(eventsOf(current), SCORE_BAR_STEPS);
      player.start(when);
    },
    stop: () => player.stop(),
    playing: () => player.playing(),
    mood: () => target,
    setMood(mood) { target = mood; },
    state: () => current,
  };
}
