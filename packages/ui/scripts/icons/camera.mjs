import { chevron } from './base.mjs';

const n = (v) => Math.round(v * 100) / 100;
const rad = (deg) => (deg * Math.PI) / 180;

// ── turn / pitch ─────────────────────────────────────────────────────────
// An axis, and a hook around it: out from behind the axis, around the far side, and straight back across the
// front to a head. The hook is cut away around the axis, which runs unbroken. The head sits on the straight
// run, not on the bend: a head on a curve leans, and its inside barb closes up against the shaft.
// `flip` mirrors the drawing left to right, and `swap` exchanges x and y, which lays the turn's vertical
// axis on its side.
// Right of center, which gives the head's run its length and puts the axis's ink on whole pixels at 16px.
const AXIS = 10.75;
/** The hook's ink ends this far short of the axis's ink. */
const GAP = 1;
const NEAR = AXIS + 0.75 + GAP + 0.75;
// The back and front runs. Their ink lands on whole pixels at 16px.
const BACK = 6.75;
const FRONT = 13.25;
const BEND = 13.6;
const BEND_RX = 2.9;
const TIP = 3.5;
function turn(flip, swap) {
  const at = ([x, y]) => {
    const fx = flip ? 20 - x : x;
    return (swap ? [n(y), n(fx)] : [n(fx), n(y)]).join(' ');
  };
  const dir = ([x, y]) => {
    const fx = flip ? -x : x;
    return swap ? [y, fx] : [fx, y];
  };
  // Clockwise on screen as drawn, and each reflection reverses it.
  const sweep = flip === swap ? 1 : 0;
  const ry = (FRONT - BACK) / 2;
  const [rx, rY] = swap ? [ry, BEND_RX] : [BEND_RX, ry];
  return (
    `<path d="M${at([AXIS, 2.8])}L${at([AXIS, 17.2])}"/>` +
    `<path d="M${at([NEAR, BACK])}L${at([BEND, BACK])}A${rx} ${rY} 0 0 ${sweep} ${at([BEND, FRONT])}L${at([NEAR, FRONT])}` +
    `M${at([2 * AXIS - NEAR, FRONT])}L${at([TIP, FRONT])}"/>` +
    `<path d="${chevron(at([TIP, FRONT]).split(' ').map(Number), dir([-1, 0]), 3.2, 45)}"/>`
  );
}

// ── dolly ────────────────────────────────────────────────────────────────
// A floor running back to the horizon, and an arrow along it.
const floor = `<path d="M7 3.8h6l3.6 12.4H3.4Z"/>`;

// ── orbit ────────────────────────────────────────────────────────────────
const C = 10;
// A tilted ring around a body, open at the top, with a head on the end that closes on the gap.
const TILT = -24;
const OX = 7.2;
const OY = 3.4;
const tilted = ([x, y]) => [n(C + x * Math.cos(rad(TILT)) - y * Math.sin(rad(TILT))), n(C + x * Math.sin(rad(TILT)) + y * Math.cos(rad(TILT)))];
const lean = ([x, y]) => [x * Math.cos(rad(TILT)) - y * Math.sin(rad(TILT)), x * Math.sin(rad(TILT)) + y * Math.cos(rad(TILT))];
const track = (deg) => tilted([OX * Math.cos(rad(deg)), -OY * Math.sin(rad(deg))]);
const ORBIT_FROM = 30;
const ORBIT_TO = -260;
const orbit =
  `<path d="M${track(ORBIT_FROM).join(' ')}A${OX} ${OY} ${TILT} 1 1 ${track(ORBIT_TO).join(' ')}"/>` +
  `<path d="${chevron(track(ORBIT_TO), lean([OX * Math.sin(rad(ORBIT_TO)), OY * Math.cos(rad(ORBIT_TO))]), 2.7, 40)}"/>`;

// ── rise / sink ──────────────────────────────────────────────────────────
const ground = `<path d="M4 16.4h12"/>`;

export const CAMERA = {
  dollyIn: `${floor}<path d="M10 13.6V7"/><path d="${chevron([10, 7], [0, -1], 2.7, 40)}"/>`,
  dollyOut: `${floor}<path d="M10 6.8V13.4"/><path d="${chevron([10, 13.4], [0, 1], 2.7, 40)}"/>`,
  turnLeft: turn(false, false),
  turnRight: turn(true, false),
  pitchUp: turn(false, true),
  pitchDown: turn(true, true),
  rise: `${ground}<path d="M10 13.6V3.6"/><path d="${chevron([10, 3.6], [0, -1], 3.2, 42)}"/>`,
  sink: `${ground}<path d="M10 3.6V13.2"/><path d="${chevron([10, 13.2], [0, 1], 3.2, 42)}"/>`,
  orbit: `${orbit}<circle cx="10" cy="10" r="1.9" fill="currentColor" stroke="none"/>`,
  home: `
    <path d="M3.4 9.8 10 3.8l6.6 6"/>
    <path d="M5.4 8.6v6.6a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1V8.6"/>
    <path d="M8.6 16.2v-4h2.8v4"/>`,
};
