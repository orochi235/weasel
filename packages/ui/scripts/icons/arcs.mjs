// The profiles an arc can travel along: a picker's worth of named curve shapes,
// all drawn between the same two points on the same baseline.
//
// These are diagrams, not scale drawings. Several of the named profiles differ by
// less than a pixel at icon size — a parabola and a sine hump are never more than
// 0.28 units apart in a 20-unit box — so each glyph draws what makes its name
// recognizable rather than the profile's exact geometry: the circle is a true
// semicircle, the plateau a flat-topped table, and the periodic ones show a full
// period about the mid line, the way the waveform is drawn.

import {
  BAND,
  BOT,
  frameOffset,
  HALF_STROKE,
  isClosed,
  MID,
  n,
  onBand,
  onWave,
  P,
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

const hump = (a, b, h) => `M${P(onBand(a, 0))}Q${P(onBand((a + b) / 2, 2 * h))} ${P(onBand(b, 0))}`;

/** Flat top on straight flanks, corners turned with radius `r`: the soft form of
 *  a square wave's positive half. Cubic controls tall enough to flatten the top
 *  overshoot the box, so this is built from arcs instead. */
const table = (r) => {
  const top = BOT - BAND;
  return (
    `M${n(X0)} ${n(BOT)}V${n(top + r)}A${n(r)} ${n(r)} 0 0 1 ${n(X0 + r)} ${n(top)}` +
    `H${n(X1 - r)}A${n(r)} ${n(r)} 0 0 1 ${n(X1)} ${n(top + r)}V${n(BOT)}`
  );
};

/** `periods` full periods of a sine about the mid line. */
const wave = (periods, amp = BAND / 2) =>
  trace((t) => [X0 + SPAN * t, MID - amp * Math.sin(2 * Math.PI * periods * t)], 4 * periods);

/** `periods` full periods of a triangle wave, starting at the mid line, rising. */
const triangleWave = (periods) => {
  const pts = [[0, 0]];
  for (let i = 0; i < periods; i++) {
    const b = i / periods,
      q = 1 / (4 * periods);
    pts.push([b + q, 1], [b + 3 * q, -1], [b + 4 * q, 0]);
  }
  return polyOn(onWave, pts);
};

/** A profile's rise at `t`, normalized to peak at 1. Kept alongside the drawings
 *  because the renderer's own profiles are the thing these name. */
const gauss = (u, m, s) => Math.exp(-(((u - m) / s) ** 2) / 2);
const fitRise = (g, k) => {
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const v = g(i / 200);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const r = hi - lo || 1;
  return trace((t) => onBand(t, (g(t) - lo) / r), k);
};

const RAW = {
  straight: `M${n(X0)} ${n(BOT)}H${n(X1)}`,
  parabola: `M${P(onBand(0, 0))}Q${P(onBand(0.5, 2))} ${P(onBand(1, 0))}`,
  circle: `M${n(X0)} ${n(BOT)}A${n(SPAN / 2)} ${n(SPAN / 2)} 0 0 1 ${n(X1)} ${n(BOT)}`,
  sine: wave(1),
  bump: fitRise((t) => 16 * t * t * (1 - t) * (1 - t), 4),
  plateau: table(3.6),
  bell: fitRise((t) => gauss(t, 0.5, 0.17), 6),
  ellipse: `M${n(X0)} ${n(BOT)}A${n(SPAN / 2)} ${n(BAND)} 0 0 1 ${n(X1)} ${n(BOT)}`,
  lob: cubic([0.08, 1.56], [0.55, 1.08]),
  dive: cubic([0.45, 1.08], [0.92, 1.56]),
  triangle: triangleWave(1),
  square: polyOn(onWave, [
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
  zigzag: triangleWave(2),
  ripple: wave(2),
  hop: hump(0, 0.5, 1) + hump(0.5, 1, 0.55),
  cusp:
    `M${P(onBand(0, 0))}Q${P(onBand(0.32, 0.22))} ${P(onBand(0.5, 1))}` +
    `Q${P(onBand(0.68, 0.22))} ${P(onBand(1, 0))}`,
};

// One shift for the whole set. Centering each glyph on its own box would break
// the shared baseline the family is read against.
const FRAME = frameOffset(Object.values(RAW));
const BASELINE = BOT + FRAME.dy;

export const ARCS = Object.fromEntries(
  Object.entries(RAW).map(([key, raw]) => {
    const d = transform(raw, 1, FRAME.dx, FRAME.dy);
    return [`arc-${key}`, { d, fill: isClosed(d) ? d : underFill(d, BASELINE, HALF_STROKE) }];
  }),
);
