import { chevron } from './base.mjs';

const n = (v) => Math.round(v * 100) / 100;
const rad = (deg) => (deg * Math.PI) / 180;

// ── turn / pitch ─────────────────────────────────────────────────────────
// A ring around an axis, drawn as it lies in space: it passes behind the axis at the back and in front of it
// at the front. Whatever passes behind is cut away along the outline of what passes in front, grown by
// `GAP`, so each cut end is flat and the clear band beside it is one width all the way across.
//
// The head does not sit on the ring. Past the axis the ring's front leaves its ellipse and runs level to
// the head, so the head has a straight shaft behind it and its barbs lie on the diagonals; a head left on
// the bend leans, and closes up on the inside. The ring's far-left arc still closes the loop behind it.
// `flip` mirrors the drawing left to right, and `swap` exchanges x and y, which lays the turn's vertical
// axis on its side.
/** The axis, right of center: the head's run gets the room, and the axis's ink lands on whole pixels at 16px. */
const AXIS = 10.75;
const MID = 10;
const RX = 6;
// Puts the ring's back and front runs on whole pixels at 16px, as `AXIS` does for the axis.
const RY = 3.25;
const STROKE = 1.5;
/** Clear space between a cut end and the ink in front of it: a pixel at 16px. */
const GAP = 1.25;
const CUT = STROKE / 2 + GAP;
const ring = (deg) => [AXIS + RX * Math.cos(rad(deg)), MID - RY * Math.sin(rad(deg))];
// Where the ring's center line meets the edge of the band cleared around the axis.
const BEHIND = (Math.acos(CUT / RX) * 180) / Math.PI;
/** Where the ring's far-left arc starts. Any further round and it crowds the head's upper barb. */
const TAIL = 150;
const FRONT = MID + RY;
const TIP = [3.9, FRONT];
const HEAD = [3, 45];
function turn(flip, swap) {
  const xy = ([x, y]) => {
    const fx = flip ? 20 - x : x;
    return swap ? [n(y), n(fx)] : [n(fx), n(y)];
  };
  const at = (p) => xy(p).join(' ');
  const dir = ([x, y]) => {
    const fx = flip ? -x : x;
    return swap ? [y, fx] : [fx, y];
  };
  // Clockwise on screen as drawn, and each reflection reverses it.
  const sweep = flip === swap ? 1 : 0;
  const [rx, ry] = swap ? [RY, RX] : [RX, RY];
  const arc = (from, to) => `M${at(ring(from))}A${rx} ${ry} 0 ${from - to > 180 ? 1 : 0} ${sweep} ${at(ring(to))}`;
  const cut = ' stroke-linecap="butt"';
  return (
    `<path d="M${at([AXIS, 2.8])}L${at([AXIS, FRONT - CUT])}M${at([AXIS, FRONT + CUT])}L${at([AXIS, 17.2])}"${cut}/>` +
    `<path d="${arc(TAIL, 180 - BEHIND)}${arc(BEHIND, -90)}L${at(TIP)}"${cut}/>` +
    // The ends that are not cuts stay round.
    `<path d="M${at([AXIS, 2.8])}h0M${at([AXIS, 17.2])}h0M${at(ring(TAIL))}h0"/>` +
    `<path d="${chevron(xy(TIP), dir([-1, 0]), ...HEAD)}"/>`
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
