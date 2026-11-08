import { chevron, n, onCircle } from '../../icons/scripts/lib/base.mjs';

// ── snowflake ────────────────────────────────────────────────────────────
// Six arms, each with one V whose barbs open outward, at 45° to the arm.
const FLAKE_R = 7.6;
const FLAKE_V = 4.4;
const flake = [90, 150, 210, 270, 330, 30]
  .map((deg) => {
    const [x, y] = onCircle(10, 10, FLAKE_R, deg);
    const tip = onCircle(10, 10, FLAKE_V, deg);
    return `M10 10L${x} ${y}` + chevron(tip, [10 - x, 10 - y], 2.3, 45);
  })
  .join('');

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

export const WEATHER = {
  snowflake: `<path d="${flake}"/>`,
  droplet: `
    <path d="${droplet}"/>
    <path d="${droplet}${shine}" fill="currentColor" stroke="none" fill-rule="evenodd"/>`,
};
