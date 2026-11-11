/** An ADSR envelope. Times are ms; `sustain` is a level, 0..1, of the peak. */
export interface Envelope {
  /** Default 5 — long enough that the onset does not click. */
  attack?: number;
  /** Default 0. */
  decay?: number;
  /** Default 1. */
  sustain?: number;
  /** Default 30. */
  release?: number;
}

/** An envelope with every default filled in and every value in range. */
export type ResolvedEnvelope = Required<Envelope>;

/** One breakpoint of an envelope's curve: a level at a time. */
export interface EnvelopePoint {
  /** ms from the note's start. */
  at: number;
  value: number;
}

/** Fill an envelope's defaults, clamping times to zero or more and `sustain` to 0..1. */
export function resolveEnvelope(env: Envelope = {}): ResolvedEnvelope {
  return {
    attack: Math.max(0, env.attack ?? 5),
    decay: Math.max(0, env.decay ?? 0),
    sustain: Math.min(1, Math.max(0, env.sustain ?? 1)),
    release: Math.max(0, env.release ?? 30),
  };
}

const heldLevel = (e: ResolvedEnvelope, t: number): number => {
  if (t < e.attack) return t / e.attack;
  if (t < e.attack + e.decay) return 1 - ((1 - e.sustain) * (t - e.attack)) / e.decay;
  return e.sustain;
};

/** The level `t` ms after the start. With `gate`, the release begins that many
 *  ms in, from whatever level the envelope had reached. */
export function envelopeLevel(e: ResolvedEnvelope, t: number, gate?: number): number {
  if (gate === undefined || t <= gate) return heldLevel(e, t);
  if (t >= gate + e.release) return 0;
  return Math.max(0, heldLevel(e, gate) * (1 - (t - gate) / e.release));
}

/**
 * Breakpoints joined by linear ramps, tracing `envelopeLevel`. Without `gate`
 * they end at the sustain, held until something releases the note; with it
 * they end at zero, `gate + release` ms in. With no decay, the attack's peak
 * and the sustain are two points at one time: the level steps between them.
 */
export function envelopePoints(e: ResolvedEnvelope, gate?: number): EnvelopePoint[] {
  const end = gate ?? Infinity;
  const points: EnvelopePoint[] = [{ at: 0, value: e.attack > 0 ? 0 : heldLevel(e, 0) }];
  const last = (): EnvelopePoint => points[points.length - 1];
  // At a gate on the attack's end the peak is still reached, then stepped from if there is no decay.
  if (e.attack > 0 && e.attack <= end) points.push({ at: e.attack, value: 1 });
  const decayEnd = e.attack + e.decay;
  if (decayEnd < end && (decayEnd > last().at || last().value !== e.sustain)) {
    points.push({ at: decayEnd, value: e.sustain });
  }
  if (gate === undefined) return points;
  const held = heldLevel(e, gate);
  if (gate > last().at || held !== last().value) points.push({ at: gate, value: held });
  points.push({ at: gate + e.release, value: 0 });
  return points;
}
