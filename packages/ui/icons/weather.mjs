import { chevron, n, onCircle } from '../../icons/scripts/lib/base.mjs';

// ── snowflake ────────────────────────────────────────────────────────────
// Six arms, each with one V whose barbs open outward, at 45° to the arm.
const FLAKE_R = 7.6;
const FLAKE_V = 4.4;
const FLAKE_ARMS = [90, 150, 210, 270, 330, 30];
const flake = FLAKE_ARMS
  .map((deg) => {
    const [x, y] = onCircle(10, 10, FLAKE_R, deg);
    const tip = onCircle(10, 10, FLAKE_V, deg);
    return `M10 10L${x} ${y}` + chevron(tip, [10 - x, 10 - y], 2.3, 45);
  })
  .join('');

// ── thaw ─────────────────────────────────────────────────────────────────
// The snowflake melted: its arms, without their Vs, shrunk to short rays clear of the center.
const thaw = FLAKE_ARMS.map((deg) => {
  const [a, b] = [onCircle(10, 10, 4.6, deg), onCircle(10, 10, 7, deg)];
  return `M${a.join(' ')}L${b.join(' ')}`;
}).join('');

// ── droplet ──────────────────────────────────────────────────────────────
// Solid, so it reads heavy beside the outlined `drop`. Built like `drop`: the
// tip meets the circle along its tangents, which sit asin(r/d) off the axis.
const DROPLET_TIP = [10, 3];
const DROPLET_C = [10, 11.6];
const DROPLET_R = 5.6;
const dTheta = Math.asin(DROPLET_R / (DROPLET_C[1] - DROPLET_TIP[1]));
const dDx = n(DROPLET_R * Math.cos(dTheta));
const dY = n(DROPLET_C[1] - DROPLET_R * Math.sin(dTheta));
const droplet = `M${DROPLET_TIP[0]} ${DROPLET_TIP[1]}L${10 + dDx} ${dY}A${DROPLET_R} ${DROPLET_R} 0 1 1 ${10 - dDx} ${dY}Z`;

// The highlight is a hole in the fill: a band round the lower left with round ends.
function band(cx, cy, r, w, from, to) {
  const [ro, ri, h] = [r + w / 2, r - w / 2, w / 2];
  const [o0, o1] = [onCircle(cx, cy, ro, from), onCircle(cx, cy, ro, to)];
  const [i0, i1] = [onCircle(cx, cy, ri, from), onCircle(cx, cy, ri, to)];
  return (
    `M${o0.join(' ')}A${ro} ${ro} 0 0 0 ${o1.join(' ')}` +
    `A${h} ${h} 0 0 0 ${i1.join(' ')}` +
    `A${ri} ${ri} 0 0 1 ${i0.join(' ')}` +
    `A${h} ${h} 0 0 0 ${o0.join(' ')}Z`
  );
}
const shine = band(...DROPLET_C, 3.4, 1.6, 200, 248);

// ── icicles / melt ───────────────────────────────────────────────────────
// Icicles under one eave, outlined, their sides bowed slightly in so they taper to slender
// tips. `melt` keeps the eave and the two big icicles' roots, so the pair reads as one scene
// before and after; the small ones are gone, being too thin to leave a readable stub.
const EAVE = 3.4;
const eave = `M2.4 ${EAVE}H17.6`;
// An icicle from roots `l`..`r` on the eave to `tip`, each side a quadratic whose control
// point sits `bow` in from the side's midpoint.
const icicle = (l, r, tip, bow = 0.6) => {
  const side = (x) => {
    const [mx, my] = [(x + tip[0]) / 2, (EAVE + tip[1]) / 2];
    return `${n(mx + Math.sign(tip[0] - x) * bow)} ${n(my)}`;
  };
  return `M${l} ${EAVE}Q${side(l)} ${tip.join(' ')}Q${side(r)} ${r} ${EAVE}`;
};
const BIG = [
  [2.8, 7.6, [5, 17.2]],
  [10.8, 15, [13, 13.4]],
];
const SMALL = [
  [8.6, 9.8, [9.2, 8.6]],
  [15.8, 17, [16.4, 7.8]],
];
const ICICLES = [...BIG.map((i) => icicle(...i, 0.3)), ...SMALL.map((i) => icicle(...i, 0.2))].join('');
const STUBS =
  `M${BIG[0][0]} ${EAVE}L3.5 6.4Q5.2 8.6 6.9 6.4L${BIG[0][1]} ${EAVE}` +
  `M${BIG[1][0]} ${EAVE}L11.4 5.8Q12.9 7.6 14.4 5.8L${BIG[1][1]} ${EAVE}`;
// A falling drop: a tip joined to a circle along its tangents, as `drop` is.
const fallingDrop = (cx, cy, r, tipY) => {
  const t = Math.asin(r / (cy - tipY));
  const dx = n(r * Math.cos(t));
  const y = n(cy - r * Math.sin(t));
  return `M${cx} ${tipY}L${n(cx + dx)} ${y}A${r} ${r} 0 1 1 ${n(cx - dx)} ${y}Z`;
};
const MELT = STUBS + fallingDrop(5.2, 15.2, 1.9, 11.2) + fallingDrop(12.9, 13, 1.5, 10);

export const WEATHER = {
  snowflake: `<path d="${flake}"/>`,
  thaw: `<path d="${thaw}"/>`,
  droplet: `
    <path d="${droplet}"/>
    <path d="${droplet}${shine}" fill="currentColor" stroke="none" fill-rule="evenodd"/>`,
  icicles: { d: eave + ICICLES, fill: ICICLES },
  melt: { d: eave + MELT, fill: MELT },
};
