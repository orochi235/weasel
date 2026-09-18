// Curves a chart or a piece of math is built from: conics, growth and decay,
// waveforms, distributions, easings, the named plane curves, and the trig family.
//
// Each is drawn in the same axis frame — same span, same band, one shift for the
// whole set — so they read as one family and not as fifty-six separate pictures.

import {
  BAND,
  BOT,
  fitted,
  frameOffset,
  HALF_STROKE,
  isClosed,
  MID,
  n,
  onBand,
  onWave,
  P,
  plot,
  plotClipped,
  polyOn,
  SPAN,
  trace,
  transform,
  underFill,
  X0,
  X1,
} from './lib/plot.mjs';

const cubic = (p1, p2) =>
  `M${P(onBand(0, 0))}C${P(onBand(...p1))} ${P(onBand(...p2))} ${P(onBand(1, 0))}`;
const gauss = (x, m, s) => Math.exp(-(((x - m) / s) ** 2) / 2);
const wave = (periods, amp = BAND / 2) =>
  trace((t) => [X0 + SPAN * t, MID - amp * Math.sin(2 * Math.PI * periods * t)], 4 * periods);

const CENTER = [10, 10];

const RAW = {
  // Conics and algebraic
  line: `M${n(X0)} ${n(MID)}H${n(X1)}`,
  parabola: `M${P(onBand(0, 0))}Q${P(onBand(0.5, 2))} ${P(onBand(1, 0))}`,
  circle: `M${n(X0)} ${n(BOT)}A${n(SPAN / 2)} ${n(SPAN / 2)} 0 0 1 ${n(X1)} ${n(BOT)}`,
  ellipse: `M${n(X0)} ${n(BOT)}A${n(SPAN / 2)} ${n(BAND)} 0 0 1 ${n(X1)} ${n(BOT)}`,
  hyperbola: plot((x) => -Math.sqrt(1 + (2.6 * (x - 0.5)) ** 2), 6),
  'hyperbola-pair':
    plot((x) => -Math.sqrt(1 + (2.6 * (x - 0.5)) ** 2), 6) +
    plot((x) => Math.sqrt(1 + (2.6 * (x - 0.5)) ** 2), 6),
  cubic: plot((x) => (2 * x - 1) ** 3, 6),
  quartic: plot((x) => (2.2 * (x - 0.5)) ** 4 - 2 * (2.2 * (x - 0.5)) ** 2, 8),
  sqrt: plot((x) => Math.sqrt(x), 6),
  reciprocal: plot((x) => -1 / (0.12 + 0.88 * x), 8),
  abs: polyOn(onBand, [
    [0, 1],
    [0.5, 0],
    [1, 1],
  ]),
  cusp:
    `M${P(onBand(0, 0))}Q${P(onBand(0.32, 0.22))} ${P(onBand(0.5, 1))}` +
    `Q${P(onBand(0.68, 0.22))} ${P(onBand(1, 0))}`,

  // Growth and decay
  exponential: plot((x) => Math.exp(3 * x), 6),
  logarithm: plot((x) => Math.log(0.05 + 0.95 * x), 8),
  decay: plot((x) => Math.exp(-3.2 * x), 6),
  sigmoid: plot((x) => 1 / (1 + Math.exp(-9 * (x - 0.5))), 6),
  softplus: plot((x) => Math.log(1 + Math.exp(9 * (x - 0.55))), 6),
  relu: polyOn(onBand, [
    [0, 0],
    [0.5, 0],
    [1, 1],
  ]),
  step: polyOn(onBand, [
    [0, 0],
    [0.5, 0],
    [0.5, 1],
    [1, 1],
  ]),
  'power-law': plot((x) => -((0.04 + 0.96 * x) ** -1.6), 8),
  catenary: plot((x) => Math.cosh(2.6 * (x - 0.5)), 6),
  bathtub: plot((x) => Math.exp(-9 * x) + Math.exp(9 * (x - 1)) + 0.12, 8),
  'hockey-stick': plot((x) => 0.06 * x + Math.exp(5.5 * (x - 1)), 6),

  // Periodic
  sine: wave(1),
  cosine: trace((t) => [X0 + SPAN * t, MID - (BAND / 2) * Math.cos(2 * Math.PI * t)], 4),
  ripple: wave(2),
  'triangle-wave': polyOn(onWave, [
    [0, 0],
    [0.25, 1],
    [0.75, -1],
    [1, 0],
  ]),
  'square-wave': polyOn(onWave, [
    [0, 0],
    [0, 1],
    [0.5, 1],
    [0.5, -1],
    [1, -1],
    [1, 0],
  ]),
  sawtooth: polyOn(onWave, [
    [0, 0],
    [0.5, 1],
    [0.5, -1],
    [1, 0],
  ]),
  stair: polyOn(onWave, [
    [0, 0],
    [0.16, 0],
    [0.16, 1],
    [0.42, 1],
    [0.42, 0],
    [0.58, 0],
    [0.58, -1],
    [0.84, -1],
    [0.84, 0],
    [1, 0],
  ]),
  'pulse-train': polyOn(onWave, [
    [0, 0],
    ...[0.18, 0.5, 0.82].flatMap((c) => [
      [c - 0.07, 0],
      [c - 0.07, 1],
      [c + 0.07, 1],
      [c + 0.07, 0],
    ]),
    [1, 0],
  ]),
  damped: trace((t) => onWave(t, Math.exp(-2.4 * t) * Math.cos(2 * Math.PI * 1.6 * t)), 14),
  chirp: trace((t) => onWave(t, 0.92 * Math.sin(Math.PI * (0.8 + 4.2 * t) * t * 2)), 20),
  beat: trace((t) => onWave(t, 0.92 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * 4 * t)), 24),

  // Distributions
  gaussian: plot((x) => gauss(x, 0.5, 0.13), 8),
  bimodal: plot((x) => gauss(x, 0.28, 0.078) + gauss(x, 0.72, 0.078), 14),
  skewed: plot((x) => gauss(Math.log(0.02 + x), Math.log(0.22), 0.55), 10),
  lorentzian: plot((x) => 1 / (1 + ((x - 0.5) / 0.09) ** 2), 10),
  ogive: plot((x) => 1 / (1 + Math.exp(-11 * (x - 0.5))), 6),
  uniform: (() => {
    const r = 3.6,
      top = BOT - BAND;
    return (
      `M${n(X0)} ${n(BOT)}V${n(top + r)}A${n(r)} ${n(r)} 0 0 1 ${n(X0 + r)} ${n(top)}` +
      `H${n(X1 - r)}A${n(r)} ${n(r)} 0 0 1 ${n(X1)} ${n(top + r)}V${n(BOT)}`
    );
  })(),
  sinc: plot((x) => {
    const z = 9 * (x - 0.5);
    return z === 0 ? 1 : Math.sin(z) / z;
  }, 16),
  impulse: polyOn(onBand, [
    [0, 0],
    [0.48, 0],
    [0.5, 1],
    [0.52, 0],
    [1, 0],
  ]),

  // Easing
  'ease-in': plot((x) => x ** 3, 6),
  'ease-out': plot((x) => 1 - (1 - x) ** 3, 6),
  'ease-in-out': plot((x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), 8),
  overshoot: plot((x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2, 8),
  bounce: (() => {
    const hop = (a, b, h) =>
      `M${P(onBand(a, 0))}Q${P(onBand((a + b) / 2, 2 * h))} ${P(onBand(b, 0))}`;
    return hop(0, 0.46, 1) + hop(0.46, 0.76, 0.45) + hop(0.76, 0.94, 0.18) + hop(0.94, 1, 0.05);
  })(),
  elastic: trace((t) => onBand(t, 1 - Math.exp(-3.4 * t) * Math.cos(2 * Math.PI * 1.9 * t)), 16),

  // Named plane curves
  lemniscate: fitted((t) => {
    const a = 2 * Math.PI * t,
      d = 1 + Math.sin(a) ** 2;
    return [CENTER[0] + (7.2 * Math.cos(a)) / d, CENTER[1] + (7.2 * Math.sin(a) * Math.cos(a)) / d];
  }, 18),
  // Cusp rotated to the top, so it reads as the heart everyone draws rather than
  // a blob with a notch in its side.
  cardioid: fitted((t) => {
    const a = 2 * Math.PI * t,
      r = 3.6 * (1 - Math.cos(a));
    return [CENTER[0] + r * Math.sin(a), CENTER[1] - r * Math.cos(a)];
  }, 28),
  astroid: fitted((t) => {
    const a = 2 * Math.PI * t;
    return [CENTER[0] + 7 * Math.cos(a) ** 3, CENTER[1] + 7 * Math.sin(a) ** 3];
  }, 20),
  rose: fitted((t) => {
    const a = 2 * Math.PI * t,
      r = 7 * Math.cos(3 * a);
    return [CENTER[0] + r * Math.cos(a), CENTER[1] + r * Math.sin(a)];
  }, 48),
  spiral: fitted((t) => {
    const a = 2 * Math.PI * 1.9 * t,
      r = 0.6 + 6.6 * t;
    return [CENTER[0] + r * Math.cos(a), CENTER[1] + r * Math.sin(a)];
  }, 18),
  lissajous: fitted((t) => {
    const a = 2 * Math.PI * t;
    return [CENTER[0] + 7 * Math.sin(3 * a), CENTER[1] + 7 * Math.sin(2 * a)];
  }, 28),
  // One arch, stretched to the band on each axis. A cycloid arch is pi times
  // wider than it is tall; fitted uniformly it renders as a flat smear.
  cycloid: trace((t) => {
    const a = 2 * Math.PI * t;
    return [X0 + (SPAN * (a - Math.sin(a))) / (2 * Math.PI), BOT - (BAND * (1 - Math.cos(a))) / 2];
  }, 12),
  superellipse: fitted((t) => {
    const a = 2 * Math.PI * t,
      c = Math.cos(a),
      s = Math.sin(a);
    return [
      CENTER[0] + 7 * Math.sign(c) * Math.abs(c) ** 0.62,
      CENTER[1] + 7 * Math.sign(s) * Math.abs(s) ** 0.62,
    ];
  }, 40),

  // Trig. Each is framed on one period centered at x = 0, which is where sec and
  // csc differ: sec(0) is 1, so its tile holds a cup, while csc(0) is a pole, so
  // its tile holds a gap. Phase-aligned instead, they are the same drawing —
  // sec(t) = csc(t + pi/2).
  tangent: plotClipped((x) => Math.tan(Math.PI * (x - 0.5) * 2) / 2.2, 8),
  cotangent: plotClipped((x) => 1 / Math.tan(Math.PI * x * 2) / 2.2, 8),
  secant: plotClipped((x) => 1 / Math.cos(2 * Math.PI * (x - 0.5)) / 2.6, 8),
  cosecant: plotClipped((x) => 1 / Math.sin(2 * Math.PI * (x - 0.5)) / 2.6, 8),
  // Domain is exactly [-1, 1], so arcsine's vertical tangents land on the frame's
  // edges rather than a clamped argument drawing flat runs across them.
  arcsine: plotClipped((x) => Math.asin(Math.max(-1, Math.min(1, 2 * x - 1))) / (Math.PI / 2), 10),
  asymptote: plotClipped((x) => 1 / (2.4 * (x - 0.5)) / 2.2, 8),
};

/** No fill: two branches of a hyperbola enclose nothing together, a spiral's area
 *  depends on where you cut it, a curve that is mostly oscillation fills to a
 *  solid block, and a function with poles has branches running off the tile. */
const NO_FILL = new Set([
  'hyperbola-pair',
  'spiral',
  'chirp',
  'beat',
  'tangent',
  'cotangent',
  'secant',
  'cosecant',
  'asymptote',
]);
/** Self-intersecting closed curves: even-odd leaves the crossings hollow, which
 *  is how these are drawn by hand. */
const EVENODD = new Set(['lissajous', 'rose']);

const FRAME = frameOffset(Object.values(RAW));
// The fill runs to the frame's own baseline, not the union's lowest point: one
// curve that overshoots the band (elastic) would otherwise deepen every fill.
const BASELINE = BOT + FRAME.dy;

export const CURVES = Object.fromEntries(
  Object.entries(RAW).map(([key, raw]) => {
    const d = transform(raw, 1, FRAME.dx, FRAME.dy);
    const fill = NO_FILL.has(key) ? null : isClosed(d) ? d : underFill(d, BASELINE, HALF_STROKE);
    return [`curve-${key}`, { d, fill, rule: EVENODD.has(key) ? 'evenodd' : undefined }];
  }),
);
