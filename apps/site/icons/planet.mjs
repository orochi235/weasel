// A planet and an inclined orbit seen nearly edge-on, drawn level about the origin and then tilted. The
// orbit is a four-arc oval, so each of its edges is a circular arc; every stroke that passes behind
// another is a filled band whose end is the front stroke's edge, slid back along the band by GAP.

const DEG = Math.PI / 180;
const q = (v) => Math.round(v * 10000) / 10000;
const P = ([x, y]) => `${q(x)} ${q(y)}`;
const at = (c, r, a) => [c[0] + r * Math.cos(a * DEG), c[1] + r * Math.sin(a * DEG)];
const angle = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]) / DEG;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The two points where circles (c1, r1) and (c2, r2) meet. */
function meet(c1, r1, c2, r2) {
  const d = dist(c1, c2);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const ux = (c2[0] - c1[0]) / d;
  const uy = (c2[1] - c1[1]) / d;
  const bx = c1[0] + a * ux;
  const by = c1[1] + a * uy;
  return [
    [bx - h * uy, by + h * ux],
    [bx + h * uy, by - h * ux],
  ];
}
const nearest = (pts, hint) => (dist(pts[0], hint) <= dist(pts[1], hint) ? pts[0] : pts[1]);

/** An arc command along circle (c, r) from `from` to `to`, turning the way `dir` says (+1: angle grows). */
function arc(c, r, from, to, dir) {
  let span = dir > 0 ? angle(c, to) - angle(c, from) : angle(c, from) - angle(c, to);
  span = ((span % 360) + 360) % 360;
  return `A${q(r)} ${q(r)} 0 ${span > 180 ? 1 : 0} ${dir > 0 ? 1 : 0} ${P(to)}`;
}

/** The short arc of the cutter circle (C, rho) from p to q. */
function cap({ C, rho }, p, to) {
  const cross = (p[0] - C[0]) * (to[1] - C[1]) - (p[1] - C[1]) * (to[0] - C[0]);
  return `A${q(rho)} ${q(rho)} 0 0 ${cross > 0 ? 1 : 0} ${P(to)}`;
}

/** A stroke `2h` wide along a chain of arcs `{c, r, from, to}` (angles growing along the chain), filled, its
 *  two ends on the cutters `head` and `tail`. Each cutter carries a `hint` near where it crosses the chain. */
function band(chain, h, head, tail) {
  const first = chain[0];
  const last = chain[chain.length - 1];
  const end = (seg, cut, side) => nearest(meet(seg.c, seg.r + side * h, cut.C, cut.rho), cut.hint);
  const outStart = end(first, head, 1);
  const inStart = end(first, head, -1);
  const outEnd = end(last, tail, 1);
  const inEnd = end(last, tail, -1);
  let d = `M${P(outStart)}`;
  let cur = outStart;
  chain.forEach((seg, i) => {
    const to = i === chain.length - 1 ? outEnd : at(seg.c, seg.r + h, seg.to);
    d += arc(seg.c, seg.r + h, cur, to, 1);
    cur = to;
  });
  d += cap(tail, outEnd, inEnd);
  cur = inEnd;
  for (let i = chain.length - 1; i >= 0; i--) {
    const seg = chain[i];
    const to = i === 0 ? inStart : at(seg.c, seg.r - h, seg.from);
    d += arc(seg.c, seg.r - h, cur, to, -1);
    cur = to;
  }
  return `${d + cap(head, inStart, outStart)}Z`;
}

/** A cutter: circle (C, rho) slid by `gap` along unit direction `u`. */
const slid = (C, rho, u, gap, hint) => ({ C: [C[0] + u[0] * gap, C[1] + u[1] * gap], rho, hint });

export function planet() {
  const R = 3.6; // planet
  const HR = 0.6; // half the rim's width
  const [A, B, R1] = [6.4, 1.4, 0.9]; // the oval's half-length, half-height and end radius
  const HO = 0.5; // half the orbit's width
  const GAP = 0.5;
  const MOON = 0.85;
  const TILT = -22;

  // The oval: end circles at (±(A - R1), 0), side circles on the y axis, each tangent to both.
  const R2 = ((A - R1) ** 2 + B * B - R1 * R1) / (2 * (B - R1));
  const top = [0, R2 - B]; // center of the far (upper) side
  const bottom = [0, B - R2]; // center of the near (lower) side
  const left = [-(A - R1), 0];
  const j = Math.atan2(R2 - B, A - R1) / DEG; // where the sides hand over to the ends

  // The moon sits on the near side, centered on the orbit where it crosses in front of the planet, so the orbit
  // runs straight into it from one side and out the other. The orbit stops a gap short of it both ways: one run
  // goes from the moon, round the right end, to where the far side goes behind the planet's right; the other
  // from the moon, round the left end, to the planet's left. The moon clears the rim's inner edge by more than GAP.
  const moon = [0, B];
  const moonR = nearest(meet(bottom, R2, moon, MOON + GAP), [MOON + GAP, B]);
  const moonL = nearest(meet(bottom, R2, moon, MOON + GAP), [-(MOON + GAP), B]);
  const farRight = nearest(meet(top, R2, [0, 0], R + HR), [R, -B]);
  const farLeft = nearest(meet(top, R2, [0, 0], R + HR), [-R, -B]);
  const away = (p, dir) => {
    const a = angle(top, p) * DEG;
    return [-Math.sin(a) * dir, Math.cos(a) * dir];
  };
  const right = [A - R1, 0];
  const rightRun = band(
    [
      { c: top, r: R2, from: angle(top, farRight), to: -j },
      { c: right, r: R1, from: -j, to: j },
      { c: bottom, r: R2, from: j, to: angle(bottom, moonR) },
    ],
    HO,
    slid([0, 0], R + HR, away(farRight, 1), GAP, farRight),
    { C: moon, rho: MOON + GAP, hint: moonR },
  );
  const leftRun = band(
    [
      { c: bottom, r: R2, from: angle(bottom, moonL), to: 180 - j },
      { c: left, r: R1, from: 180 - j, to: 360 - (180 - j) },
      { c: top, r: R2, from: -180 + j, to: angle(top, farLeft) },
    ],
    HO,
    { C: moon, rho: MOON + GAP, hint: moonL },
    slid([0, 0], R + HR, away(farLeft, -1), GAP, farLeft),
  );

  // The rim, cut where the near side crosses it: above the crossing by the orbit's upper edge, below by its lower.
  const crossR = nearest(meet([0, 0], R, bottom, R2), [R, B]);
  const crossL = nearest(meet([0, 0], R, bottom, R2), [-R, B]);
  const aR = angle([0, 0], crossR);
  const aL = angle([0, 0], crossL);
  const rimDir = (a, dir) => [-Math.sin(a * DEG) * dir, Math.cos(a * DEG) * dir];
  const above = R2 - HO;
  const below = R2 + HO;
  const upper = band(
    [{ c: [0, 0], r: R, from: aL, to: aR + 360 }],
    HR,
    slid(bottom, above, rimDir(aL, 1), GAP, crossL),
    slid(bottom, above, rimDir(aR, -1), GAP, crossR),
  );
  const lower = band(
    [{ c: [0, 0], r: R, from: aR, to: aL }],
    HR,
    slid(bottom, below, rimDir(aR, 1), GAP, crossR),
    slid(bottom, below, rimDir(aL, -1), GAP, crossL),
  );

  return `
    <g transform="translate(10 10) rotate(${TILT})" fill="currentColor" stroke="none">
      <path d="${upper}"/><path d="${lower}"/><path d="${rightRun}"/><path d="${leftRun}"/>
      <circle cx="0" cy="${B}" r="${MOON}"/>
    </g>`;
}
