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

export type ResolvedEnvelope = Required<Envelope>;

export interface EnvelopePoint {
  /** ms from the note's start. */
  at: number;
  value: number;
}

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
  if (e.release === 0) return 0;
  return Math.max(0, heldLevel(e, gate) * (1 - (t - gate) / e.release));
}

/**
 * Breakpoints joined by linear ramps. Without `gate` they end at the sustain,
 * held until something releases the note; with it they end at zero, `gate +
 * release` ms in.
 */
export function envelopePoints(e: ResolvedEnvelope, gate?: number): EnvelopePoint[] {
  const end = gate ?? Infinity;
  const points: EnvelopePoint[] = [{ at: 0, value: e.attack > 0 ? 0 : 1 }];
  for (const at of [e.attack, e.attack + e.decay]) {
    if (at <= points[points.length - 1].at) continue;
    if (at >= end) break;
    points.push({ at, value: heldLevel(e, at) });
  }
  if (gate === undefined) return points;
  if (gate > points[points.length - 1].at) points.push({ at: gate, value: heldLevel(e, gate) });
  points.push({ at: gate + e.release, value: 0 });
  return points;
}
