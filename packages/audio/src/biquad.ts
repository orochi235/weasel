/** A biquad's coefficients, already divided by `a0`. */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * The coefficients a `BiquadFilterNode` of `type` runs at `frequency`, by the
 * formulas in the Web Audio specification. `Q` is in dB for a lowpass or a
 * highpass and a plain quality factor for the rest, as it is on the node, and
 * `gain` is dB, read by the shelves and the peaking filter only. Pass `into`
 * to have them written to an object you keep, which allocates nothing.
 */
export function biquadCoefficients(
  type: BiquadFilterType,
  frequency: number,
  sampleRate: number,
  Q = 1,
  gain = 0,
  into: BiquadCoefficients = { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 },
): BiquadCoefficients {
  // Strictly inside (0, Nyquist), where every formula below is finite.
  const f = Math.min(Math.max(frequency, 1e-3), sampleRate * 0.4999);
  const w0 = (2 * Math.PI * f) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const A = 10 ** (gain / 40);
  const alphaQ = sin / (2 * Math.max(Q, 1e-4));
  const alphaDb = sin / (2 * 10 ** (Q / 20));
  const shelf = sin * Math.SQRT2 * Math.sqrt(A);
  let b0 = (1 - cos) / 2;
  let b1 = 1 - cos;
  let b2 = b0;
  let a0 = 1 + alphaDb;
  let a1 = -2 * cos;
  let a2 = 1 - alphaDb;
  if (type === 'highpass') {
    b0 = b2 = (1 + cos) / 2;
    b1 = -(1 + cos);
  } else if (type === 'peaking') {
    b0 = 1 + alphaQ * A;
    b1 = -2 * cos;
    b2 = 1 - alphaQ * A;
    a0 = 1 + alphaQ / A;
    a2 = 1 - alphaQ / A;
  } else if (type === 'lowshelf') {
    b0 = A * (A + 1 - (A - 1) * cos + shelf);
    b1 = 2 * A * (A - 1 - (A + 1) * cos);
    b2 = A * (A + 1 - (A - 1) * cos - shelf);
    a0 = A + 1 + (A - 1) * cos + shelf;
    a1 = -2 * (A - 1 + (A + 1) * cos);
    a2 = A + 1 + (A - 1) * cos - shelf;
  } else if (type === 'highshelf') {
    b0 = A * (A + 1 + (A - 1) * cos + shelf);
    b1 = -2 * A * (A - 1 + (A + 1) * cos);
    b2 = A * (A + 1 + (A - 1) * cos - shelf);
    a0 = A + 1 - (A - 1) * cos + shelf;
    a1 = 2 * (A - 1 - (A + 1) * cos);
    a2 = A + 1 - (A - 1) * cos - shelf;
  } else if (type !== 'lowpass') {
    // Bandpass, notch, and allpass share a denominator and differ above it.
    a0 = 1 + alphaQ;
    a2 = 1 - alphaQ;
    b0 = type === 'bandpass' ? alphaQ : type === 'notch' ? 1 : 1 - alphaQ;
    b1 = type === 'bandpass' ? 0 : -2 * cos;
    b2 = type === 'bandpass' ? -alphaQ : type === 'notch' ? 1 : 1 + alphaQ;
  }
  into.b0 = b0 / a0;
  into.b1 = b1 / a0;
  into.b2 = b2 / a0;
  into.a1 = a1 / a0;
  into.a2 = a2 / a0;
  return into;
}

/** How much a filter with coefficients `c` passes at `hz`, in dB. */
export function biquadResponseDb(c: BiquadCoefficients, hz: number, sampleRate: number): number {
  const w = (2 * Math.PI * hz) / sampleRate;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  const num = (c.b0 + c.b1 * c1 + c.b2 * c2) ** 2 + (c.b1 * s1 + c.b2 * s2) ** 2;
  const den = (1 + c.a1 * c1 + c.a2 * c2) ** 2 + (c.a1 * s1 + c.a2 * s2) ** 2;
  return 10 * Math.log10(num / den);
}
