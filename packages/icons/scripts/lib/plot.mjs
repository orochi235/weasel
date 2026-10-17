// Machinery for the glyphs that are drawings of functions and shapes rather than
// pictograms: sampling, fitting, measuring and placing a path.
//
// Every path here is emitted with absolute commands only. `parse` rejects a
// relative one rather than mis-measuring it.

/** The drawing area inside the 20x20 viewBox, and the band a plotted function
 *  fills. The band's center is 9.6, not 10 — a set drawn in it needs one shift to
 *  sit on the middle of the box, which `frameOffset` computes. */
export const X0 = 2.6;
export const X1 = 17.4;
export const TOP = 4.6;
export const BOT = 14.6;
export const SPAN = X1 - X0;
export const BAND = BOT - TOP;
export const MID = (TOP + BOT) / 2;
export const BOX = 14.8;
export const CENTER = 10;
/** Half of the set's 1.5 stroke, which is how far a round cap reaches past the
 *  path's own end. */
export const HALF_STROKE = 0.75;

export const n = (v) => String(Math.round(v * 100) / 100);
export const P = (p) => `${n(p[0])} ${n(p[1])}`;

const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 };

export function parse(d) {
  const out = [];
  for (const m of d.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const op = m[0];
    if (op !== op.toUpperCase() && op !== 'z') {
      throw new Error(`relative command "${op}" in ${d.slice(0, 40)}`);
    }
    const v = (m.slice(1).match(NUM) ?? []).map(Number);
    const per = ARITY[op.toUpperCase()];
    if (per === undefined) throw new Error(`unsupported command "${op}"`);
    if (per === 0) {
      out.push({ op: 'Z', v: [] });
      continue;
    }
    for (let i = 0; i < v.length; i += per)
      out.push({ op: op.toUpperCase(), v: v.slice(i, i + per) });
  }
  return out;
}

const cubicAt = (a, b, c, e, t) => {
  const u = 1 - t;
  return [
    u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * e[0],
    u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * e[1],
  ];
};

/** Endpoint-parameterized elliptical arc, per the SVG implementation notes. */
function arcPoints(p0, p1, rx, ry, rot, laf, sf, per = 60) {
  const phi = (rot * Math.PI) / 180;
  const cp = Math.cos(phi),
    sp = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2,
    dy = (p0[1] - p1[1]) / 2;
  const x1 = cp * dx + sp * dy,
    y1 = -sp * dx + cp * dy;
  let RX = Math.abs(rx),
    RY = Math.abs(ry);
  const lam = (x1 * x1) / (RX * RX) + (y1 * y1) / (RY * RY);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    RX *= s;
    RY *= s;
  }
  const num = RX * RX * RY * RY - RX * RX * y1 * y1 - RY * RY * x1 * x1;
  const den = RX * RX * y1 * y1 + RY * RY * x1 * x1;
  const co = (laf !== sf ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * RX * y1) / RY,
    cyp = (-co * RY * x1) / RX;
  const cx = cp * cxp - sp * cyp + (p0[0] + p1[0]) / 2;
  const cy = sp * cxp + cp * cyp + (p0[1] + p1[1]) / 2;
  const angle = (ux, uy, vx, vy) => {
    const s = Math.sign(ux * vy - uy * vx) || 1;
    const c = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return s * Math.acos(Math.min(1, Math.max(-1, c)));
  };
  const t1 = angle(1, 0, (x1 - cxp) / RX, (y1 - cyp) / RY);
  let dt = angle((x1 - cxp) / RX, (y1 - cyp) / RY, (-x1 - cxp) / RX, (-y1 - cyp) / RY);
  if (sf === 0 && dt > 0) dt -= 2 * Math.PI;
  if (sf === 1 && dt < 0) dt += 2 * Math.PI;
  const out = [];
  for (let i = 1; i <= per; i++) {
    const a = t1 + dt * (i / per);
    const ex = RX * Math.cos(a),
      ey = RY * Math.sin(a);
    out.push([cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
  return out;
}

// Straight runs are sampled as densely as curved ones. With one point per line
// segment, a fixed look-ahead in `corners` reaches several vertices away and
// reports a decagon's corner as 36 degrees instead of 144.
const STEPS = 40;
const lineTo = (a, b, out) => {
  for (let i = 1; i <= STEPS; i++) {
    out.push([a[0] + (b[0] - a[0]) * (i / STEPS), a[1] + (b[1] - a[1]) * (i / STEPS)]);
  }
};

/** Dense sample of every point the path passes through. */
export function sample(d) {
  const out = [];
  let cur = [0, 0],
    start = [0, 0];
  for (const { op, v } of parse(d)) {
    if (op === 'M') {
      cur = [v[0], v[1]];
      start = cur;
      out.push(cur);
    } else if (op === 'L') {
      const e = [v[0], v[1]];
      lineTo(cur, e, out);
      cur = e;
    } else if (op === 'H') {
      const e = [v[0], cur[1]];
      lineTo(cur, e, out);
      cur = e;
    } else if (op === 'V') {
      const e = [cur[0], v[0]];
      lineTo(cur, e, out);
      cur = e;
    } else if (op === 'C') {
      const b = [v[0], v[1]],
        c = [v[2], v[3]],
        e = [v[4], v[5]];
      for (let i = 1; i <= STEPS; i++) out.push(cubicAt(cur, b, c, e, i / STEPS));
      cur = e;
    } else if (op === 'Q') {
      const c = [v[0], v[1]],
        e = [v[2], v[3]];
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS,
          u = 1 - t;
        out.push([
          u * u * cur[0] + 2 * u * t * c[0] + t * t * e[0],
          u * u * cur[1] + 2 * u * t * c[1] + t * t * e[1],
        ]);
      }
      cur = e;
    } else if (op === 'A') {
      const e = [v[5], v[6]];
      out.push(...arcPoints(cur, e, v[0], v[1], v[2], v[3], v[4]));
      cur = e;
    } else if (op === 'Z') {
      lineTo(cur, start, out);
      cur = start;
    }
  }
  return out;
}

export function bbox(d) {
  const pts = sample(d);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  return {
    x0,
    x1,
    y0,
    y1,
    w: x1 - x0,
    h: y1 - y0,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
  };
}

/** Re-emit a path under a uniform scale about the origin and a translation. */
export function transform(d, k, ox, oy) {
  const X = (x) => n(x * k + ox),
    Y = (y) => n(y * k + oy);
  let out = '';
  for (const { op, v } of parse(d)) {
    if (op === 'M' || op === 'L') out += `${op}${X(v[0])} ${Y(v[1])}`;
    else if (op === 'H') out += `H${X(v[0])}`;
    else if (op === 'V') out += `V${Y(v[0])}`;
    else if (op === 'C')
      out += `C${X(v[0])} ${Y(v[1])} ${X(v[2])} ${Y(v[3])} ${X(v[4])} ${Y(v[5])}`;
    else if (op === 'Q') out += `Q${X(v[0])} ${Y(v[1])} ${X(v[2])} ${Y(v[3])}`;
    else if (op === 'A')
      out += `A${n(v[0] * k)} ${n(v[1] * k)} ${v[2]} ${v[3]} ${v[4]} ${X(v[5])} ${Y(v[6])}`;
    else out += 'Z';
  }
  return out;
}

/** Scale to fill `box` and center on the middle of the viewBox. */
export function place(d, box = BOX) {
  const b = bbox(d);
  const k = Math.min(box / (b.w || box), box / (b.h || box));
  return transform(d, k, CENTER - b.cx * k, CENTER - b.cy * k);
}

/** The one translation that centers a whole set's common bounding box.
 *
 *  A set that shares an axis frame must be shifted together: centering each glyph
 *  on its own box breaks the frame, so a half-height arc stops sharing a baseline
 *  with a full-height one, and a flat line jumps to the middle of its tile. */
export function frameOffset(paths) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const d of paths) {
    const b = bbox(d);
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    y0 = Math.min(y0, b.y0);
    y1 = Math.max(y1, b.y1);
  }
  return { dx: CENTER - (x0 + x1) / 2, dy: CENTER - (y0 + y1) / 2 };
}

/** True when every subpath closes on itself — a shape, not an open curve. */
export function isClosed(d) {
  return (d.match(/M[^M]*/g) ?? []).every((run) => {
    if (/Z\s*$/.test(run.trim())) return true;
    const pts = sample(run);
    return Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01;
  });
}

/** The region an open curve encloses with `baseline`, for the optional fill.
 *
 *  Each subpath closes on its own, so a function with poles (tan, sec) fills
 *  branch by branch instead of joining across the gap. `cap` extends the region
 *  to the outer edge of the stroke: a round cap puts the visible tip half a
 *  stroke past the path's endpoint, so a fill built from the geometry alone stops
 *  short of the line the eye sees. Pass 0 for a butt cap, which has no tip to
 *  reach and would leak past the end instead. */
export function underFill(d, baseline, cap = HALF_STROKE) {
  return (d.match(/M[^M]*/g) ?? [])
    .map((run) => {
      const pts = sample(run);
      const a = pts[0],
        z = pts.at(-1);
      if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 0.01) return `${run.replace(/Z$/, '')}Z`;
      const out = (from, toward) => {
        const dx = from[0] - toward[0],
          dy = from[1] - toward[1];
        const m = Math.hypot(dx, dy) || 1;
        return [from[0] + (dx / m) * cap, from[1] + (dy / m) * cap];
      };
      const a2 = out(a, pts[Math.min(4, pts.length - 1)]);
      const z2 = out(z, pts[Math.max(0, pts.length - 5)]);
      const base = baseline + cap;
      return `M${P(a2)}L${P(a)}${run.replace(/^M[^A-Za-z]*/, '')}L${P(z2)}L${n(z2[0])} ${n(base)}L${n(a2[0])} ${n(base)}Z`;
    })
    .join('');
}

/** Interior angles, in degrees, at every tangent discontinuity — the corners a
 *  linejoin has to render, smallest first. Directions are taken a few samples
 *  either side of the vertex; comparing immediate neighbors makes the rounding
 *  of a sampled arc look like a hairpin. */
export function corners(d, look = 4, minTurn = 25) {
  const out = [];
  for (const run of d.match(/M[^M]*/g) ?? []) {
    const closed = /Z\s*$/.test(run.trim());
    const dedup = [];
    for (const p of sample(run)) {
      const last = dedup.at(-1);
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-6) dedup.push(p);
    }
    const len = dedup.length;
    if (len < 2 * look + 2) continue;
    const at = (i) => dedup[((i % len) + len) % len];
    for (let i = closed ? 0 : look; i < (closed ? len : len - look); i++) {
      const a = at(i - look),
        b = at(i),
        c = at(i + look);
      const u = [b[0] - a[0], b[1] - a[1]],
        v = [c[0] - b[0], c[1] - b[1]];
      const mu = Math.hypot(u[0], u[1]),
        mv = Math.hypot(v[0], v[1]);
      if (mu < 1e-9 || mv < 1e-9) continue;
      const cos = Math.min(1, Math.max(-1, (u[0] * v[0] + u[1] * v[1]) / (mu * mv)));
      const turn = (Math.acos(cos) * 180) / Math.PI;
      if (turn > minTurn) out.push(180 - turn);
    }
  }
  return out.sort((a, b) => a - b);
}

/** How far a miter join juts past a corner, as a multiple of the stroke width.
 *  Past `stroke-miterlimit` (4 by default) the renderer silently draws a bevel. */
export const miterRatio = (deg) => 1 / Math.sin((deg * Math.PI) / 360);

/** Hermite fit of a parametric curve, `k` cubic segments, knots uniform in t. */
export function trace(f, k = 6, t0 = 0, t1 = 1) {
  const h = 1e-5;
  const deriv = (t) => {
    const a = f(Math.max(t0, t - h)),
      b = f(Math.min(t1, t + h));
    const dt = Math.min(t1, t + h) - Math.max(t0, t - h);
    const m = [(b[0] - a[0]) / dt, (b[1] - a[1]) / dt];
    // A cusp has an unbounded derivative; an unclamped control point there flings
    // a line clear across the canvas.
    const mag = Math.hypot(m[0], m[1]);
    return mag > 400 ? [(m[0] / mag) * 400, (m[1] / mag) * 400] : m;
  };
  let d = `M${P(f(t0))}`;
  for (let i = 0; i < k; i++) {
    const a = t0 + ((t1 - t0) * i) / k,
      b = t0 + ((t1 - t0) * (i + 1)) / k,
      s = (b - a) / 3;
    const pa = f(a),
      pb = f(b),
      ma = deriv(a),
      mb = deriv(b);
    d += `C${P([pa[0] + ma[0] * s, pa[1] + ma[1] * s])} ${P([pb[0] - mb[0] * s, pb[1] - mb[1] * s])} ${P(pb)}`;
  }
  return d;
}

/** Hermite fit with knots spaced by arc length instead of by t.
 *
 *  Uniform knots put a steep end's control point far outside the box — sqrt at 0
 *  has an infinite slope, and its first control point landed twelve units above
 *  the top of the viewBox, so the stroke shot off the tile and came back. */
export function traceArc(f, k = 6) {
  const N = 800;
  const dense = [];
  for (let i = 0; i <= N; i++) dense.push(f(i / N));
  const cum = [0];
  for (let i = 1; i <= N; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const total = cum[N];
  const knots = [];
  let j = 0;
  for (let i = 0; i <= k; i++) {
    const want = (total * i) / k;
    while (j < N && cum[j + 1] < want) j++;
    const seg = cum[j + 1] - cum[j];
    const u = seg > 0 ? (want - cum[j]) / seg : 0;
    const next = dense[Math.min(N, j + 1)];
    knots.push([
      dense[j][0] + (next[0] - dense[j][0]) * u,
      dense[j][1] + (next[1] - dense[j][1]) * u,
    ]);
  }
  let d = `M${P(knots[0])}`;
  for (let i = 0; i < k; i++) {
    const p0 = knots[Math.max(0, i - 1)],
      p1 = knots[i],
      p2 = knots[i + 1],
      p3 = knots[Math.min(k, i + 2)];
    d +=
      `C${P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])}` +
      ` ${P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P(p2)}`;
  }
  return d;
}

/** Plot y = g(x) for x in 0..1, auto-scaled to fill the band. */
export function plot(g, k = 6) {
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const v = g(i / 200);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const r = hi - lo || 1;
  return traceArc((t) => [X0 + SPAN * t, BOT - BAND * ((g(t) - lo) / r)], k);
}

/** Sample a curve, then scale and center it on its own bounding box.
 *  A cardioid's mass sits off its polar origin, so one placed by its origin — or
 *  by a hand-tuned nudge — is visibly off-center. */
export function fitted(f, k = 20, box = BOX) {
  const N = 1200;
  let lx = Infinity,
    hx = -Infinity,
    ly = Infinity,
    hy = -Infinity;
  for (let i = 0; i <= N; i++) {
    const [x, y] = f(i / N);
    lx = Math.min(lx, x);
    hx = Math.max(hx, x);
    ly = Math.min(ly, y);
    hy = Math.max(hy, y);
  }
  const k2 = Math.min(box / (hx - lx), box / (hy - ly));
  const ox = CENTER - ((lx + hx) / 2) * k2,
    oy = CENTER - ((ly + hy) / 2) * k2;
  return trace((t) => {
    const [x, y] = f(t);
    return [x * k2 + ox, y * k2 + oy];
  }, k);
}

/** y = g(x) mapped from -1..1 onto the band, broken into a subpath wherever the
 *  value leaves it. A pole becomes a gap, which is what makes tan read as tan
 *  rather than as a steep sigmoid. */
export function plotClipped(g, knotsPerRun = 7) {
  const N = 400;
  const runs = [];
  let run = [];
  for (let i = 0; i <= N; i++) {
    const x = i / N,
      v = g(x);
    if (!Number.isFinite(v) || Math.abs(v) > 1) {
      if (run.length > 2) runs.push(run);
      run = [];
      continue;
    }
    run.push([X0 + SPAN * x, MID - (BAND / 2) * v]);
  }
  if (run.length > 2) runs.push(run);
  return runs
    .map((r) => {
      const step = Math.max(1, Math.floor((r.length - 1) / knotsPerRun));
      const knots = r.filter((_, i) => i % step === 0);
      if (knots.at(-1) !== r.at(-1)) knots.push(r.at(-1));
      let d = `M${P(knots[0])}`;
      const k = knots.length - 1;
      for (let i = 0; i < k; i++) {
        const p0 = knots[Math.max(0, i - 1)],
          p1 = knots[i],
          p2 = knots[i + 1],
          p3 = knots[Math.min(k, i + 2)];
        d +=
          `C${P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])}` +
          ` ${P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P(p2)}`;
      }
      return d;
    })
    .join('');
}

/** Profile-space helpers: `ax` 0..1 across the span, `ay` 0..1 up from the
 *  baseline; `wy` -1..1 about the mid line, for a wave. */
export const onBand = (ax, ay) => [X0 + SPAN * ax, BOT - BAND * ay];
export const onWave = (ax, wy) => [X0 + SPAN * ax, MID - (BAND / 2) * wy];
export const polyOn = (map, pts) =>
  `M${P(map(...pts[0]))}` +
  pts
    .slice(1)
    .map((p) => `L${P(map(...p))}`)
    .join('');
