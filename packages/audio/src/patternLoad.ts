import { resolveEnvelope } from './envelope';
import { patternLength, type PatternEvent, type PatternHit } from './patternPlayer';

/** Options for `patternVoicePeaks`. The first four mean what they mean to
 *  `createPatternPlayer`, and should be the values the player is given. */
export interface PatternLoadOptions {
  tempo: number;
  stepsPerBeat?: number;
  length?: number;
  loop?: boolean;
  /** The bus of an event that names none: the engine's first. Default 'sfx'. */
  bus?: string;
  /** The engine's `lookahead` in ms. Default 100. */
  lookahead?: number;
  /** How long a buffer hit sounds, in ms. Default: one step. */
  hitMs?: (hit: PatternHit) => number;
}

/**
 * The most voices a pattern holds at once on each bus, to set against the
 * engine's `voiceLimit` before the pattern plays: past the limit, each new
 * event steals a voice that is still ringing.
 *
 * A note or a noise holds its voice through its gate and its envelope's
 * release. With `loop`, what rings past the end of a pass is counted against
 * the start of the next.
 */
export function patternVoicePeaks(
  events: readonly PatternEvent[],
  opts: PatternLoadOptions,
): Record<string, number> {
  const stepsPerBeat = opts.stepsPerBeat ?? 4;
  const stepMs = 60_000 / opts.tempo / stepsPerBeat;
  const passMs = (opts.length ?? patternLength(events, stepsPerBeat)) * stepMs;
  // The engine takes a voice's slot when its booking fires, which is up to a
  // lookahead before the voice sounds.
  const lead = opts.lookahead ?? 100;

  const spans = events.map((e) => {
    const sounds = 'sound' in e
      ? (opts.hitMs?.(e) ?? stepMs)
      : (e.length ?? 1) * stepMs + resolveEnvelope(e.envelope).release;
    const at = e.step * stepMs;
    return { bus: e.bus ?? opts.bus ?? 'sfx', from: at - lead, until: at + sounds };
  });
  // Enough passes that the last one meets every tail still ringing into it.
  const longest = Math.max(0, ...spans.map((s) => s.until - s.from));
  const passes = opts.loop === false ? 0 : Math.ceil(longest / passMs);

  const edges = new Map<string, { at: number; by: number }[]>();
  for (const span of spans) {
    const list = edges.get(span.bus) ?? [];
    edges.set(span.bus, list);
    for (let pass = 0; pass <= passes; pass++) {
      list.push({ at: span.from + pass * passMs, by: 1 }, { at: span.until + pass * passMs, by: -1 });
    }
  }

  const peaks: Record<string, number> = {};
  for (const [bus, list] of edges) {
    // A voice ending as another starts has freed its slot.
    list.sort((a, b) => a.at - b.at || a.by - b.by);
    let held = 0;
    let peak = 0;
    for (const edge of list) {
      held += edge.by;
      peak = Math.max(peak, held);
    }
    peaks[bus] = peak;
  }
  return peaks;
}
