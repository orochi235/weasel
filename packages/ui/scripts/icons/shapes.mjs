// Plane geometry: the polygons, the round shapes, the stars, and a few
// constructions. Each is fitted and centered on its own bounding box, because
// unlike the curve sets these share no axis frame — only the tile.

import {
  BOX,
  bbox,
  CENTER,
  corners,
  HALF_STROKE,
  isClosed,
  miterRatio,
  n,
  P,
  transform,
  underFill,
} from './lib/plot.mjs';

const R = BOX / 2;
const C = CENTER;

/** Fit a polyline to the box, closing it unless told otherwise. */
function fit(pts, close = true, box = BOX) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const lx = Math.min(...xs),
    hx = Math.max(...xs);
  const ly = Math.min(...ys),
    hy = Math.max(...ys);
  const k = Math.min(box / (hx - lx || 1), box / (hy - ly || 1));
  const o = (p) => [C + (p[0] - (lx + hx) / 2) * k, C + (p[1] - (ly + hy) / 2) * k];
  return (
    `M${P(o(pts[0]))}` +
    pts
      .slice(1)
      .map((p) => `L${P(o(p))}`)
      .join('') +
    (close ? 'Z' : '')
  );
}

/** Regular n-gon, first vertex at `rot` degrees; 0 points right, -90 points up. */
const ngon = (sides, rot = -90) =>
  Array.from({ length: sides }, (_, i) => {
    const a = ((rot + (360 * i) / sides) * Math.PI) / 180;
    return [C + R * Math.cos(a), C + R * Math.sin(a)];
  });

/** Star with `points` tips, inner radius as a share of the outer. */
const star = (points, inner, rot = -90) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const a = ((rot + (360 * i) / (points * 2)) * Math.PI) / 180;
    const r = R * (i % 2 === 0 ? 1 : inner);
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  });

const arc = (rx, ry, laf, sf, to) => `A${n(rx)} ${n(ry)} 0 ${laf} ${sf} ${P(to)}`;
const onCircle = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

// Two legs and the arc marking the angle between them. The mark is a true arc
// about the vertex: a wrong sweep flag still draws a valid arc through both ends,
// but it bows the other way, which is easy to miss at tile size.
const ANGLE = (() => {
  const v = [C - R, C + R * 0.7];
  const a = [C + R * 0.82, C + R * 0.7];
  const b = [C + R * 0.5, C - R * 0.86];
  const dir = (p) => Math.atan2(p[1] - v[1], p[0] - v[0]);
  const mark = 3.2;
  const on = (t) => [v[0] + mark * Math.cos(t), v[1] + mark * Math.sin(t)];
  const [t0, t1] = [dir(a), dir(b)];
  return {
    v,
    mark,
    d: `M${P(a)}L${P(v)}L${P(b)}M${P(on(t0))}${arc(mark, mark, 0, t1 > t0 ? 1 : 0, on(t1))}`,
    // One region, the wedge the legs enclose — not one per subpath.
    fill: `M${P(v)}L${P(a)}L${P(b)}Z`,
  };
})();

const RAW = {
  // Straight-edged
  triangle: fit(ngon(3)),
  'right-triangle': fit([
    [0, 1],
    [0, 0],
    [1, 1],
  ]),
  square: fit([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]),
  rectangle: fit([
    [0, 0],
    [1.6, 0],
    [1.6, 1],
    [0, 1],
  ]),
  diamond: fit(ngon(4)),
  parallelogram: fit([
    [0.26, 0],
    [1.4, 0],
    [1.14, 1],
    [0, 1],
  ]),
  trapezoid: fit([
    [0.26, 0],
    [1.14, 0],
    [1.4, 1],
    [0, 1],
  ]),
  kite: fit([
    [0.5, 0],
    [1, 0.4],
    [0.5, 1.15],
    [0, 0.4],
  ]),
  pentagon: fit(ngon(5)),
  hexagon: fit(ngon(6, -90)),
  'hexagon-flat': fit(ngon(6, 0)),
  heptagon: fit(ngon(7)),
  octagon: fit(ngon(8, -90 + 22.5)),
  decagon: fit(ngon(10)),
  dodecagon: fit(ngon(12)),
  cross: fit([
    [0.34, 0],
    [0.66, 0],
    [0.66, 0.34],
    [1, 0.34],
    [1, 0.66],
    [0.66, 0.66],
    [0.66, 1],
    [0.34, 1],
    [0.34, 0.66],
    [0, 0.66],
    [0, 0.34],
    [0.34, 0.34],
  ]),
  'l-shape': fit([
    [0, 0],
    [0.42, 0],
    [0.42, 0.62],
    [1, 0.62],
    [1, 1],
    [0, 1],
  ]),
  chevron: fit([
    [0, 0],
    [0.5, 0.42],
    [1, 0],
    [1, 0.34],
    [0.5, 0.76],
    [0, 0.34],
  ]),

  // Stars
  star: fit(star(5, 0.48)),
  'star-4': fit(star(4, 0.38)),
  'star-6': fit(star(6, 0.56)),
  'star-8': fit(star(8, 0.62)),
  pentagram: (() => {
    const v = ngon(5);
    return fit([0, 2, 4, 1, 3].map((i) => v[i]));
  })(),

  // Round
  circle: `M${n(C - R)} ${n(C)}${arc(R, R, 1, 1, [C + R, C])}${arc(R, R, 1, 1, [C - R, C])}Z`,
  ellipse: `M${n(C - R)} ${n(C)}${arc(R, R * 0.64, 1, 1, [C + R, C])}${arc(R, R * 0.64, 1, 1, [C - R, C])}Z`,
  semicircle: `M${n(C - R)} ${n(C + R / 2)}${arc(R, R, 0, 1, [C + R, C + R / 2])}Z`,
  quarter: `M${n(C - R)} ${n(C + R)}V${n(C - R)}${arc(BOX, BOX, 0, 1, [C + R, C + R])}Z`,
  stadium: (() => {
    const w = R,
      h = R * 0.56;
    return (
      `M${n(C - w + h)} ${n(C - h)}H${n(C + w - h)}${arc(h, h, 0, 1, [C + w - h, C + h])}` +
      `H${n(C - w + h)}${arc(h, h, 0, 1, [C - w + h, C - h])}Z`
    );
  })(),
  'rounded-square': (() => {
    const r = 3.4,
      a = C - R,
      b = C + R;
    return (
      `M${n(a + r)} ${n(a)}H${n(b - r)}${arc(r, r, 0, 1, [b, a + r])}V${n(b - r)}` +
      `${arc(r, r, 0, 1, [b - r, b])}H${n(a + r)}${arc(r, r, 0, 1, [a, b - r])}V${n(a + r)}` +
      `${arc(r, r, 0, 1, [a + r, a])}Z`
    );
  })(),
  ring:
    `M${n(C - R)} ${n(C)}${arc(R, R, 1, 1, [C + R, C])}${arc(R, R, 1, 1, [C - R, C])}Z` +
    `M${n(C - R * 0.52)} ${n(C)}${arc(R * 0.52, R * 0.52, 1, 0, [C + R * 0.52, C])}` +
    `${arc(R * 0.52, R * 0.52, 1, 0, [C - R * 0.52, C])}Z`,
  crescent: `M${n(C)} ${n(C - R)}${arc(R, R, 1, 1, [C, C + R])}${arc(R * 1.15, R * 1.15, 0, 0, [C, C - R])}Z`,
  lens: `M${n(C)} ${n(C - R)}${arc(R * 1.35, R * 1.35, 0, 1, [C, C + R])}${arc(R * 1.35, R * 1.35, 0, 1, [C, C - R])}Z`,
  // A 107-degree slice, and a 140-degree cap: enough body that each reads as an
  // area rather than a sliver.
  sector: `M${n(C)} ${n(C)}L${P(onCircle(C, C, R, -143))}${arc(R, R, 0, 1, onCircle(C, C, R, -37))}Z`,
  segment: `M${P(onCircle(C, C, R, -160))}${arc(R, R, 0, 1, onCircle(C, C, R, -20))}Z`,
  arch: `M${n(C - R)} ${n(C + R)}V${n(C)}${arc(R, R, 0, 1, [C + R, C])}V${n(C + R)}Z`,
  // Round below, drawn to a point at the top. The straight sides are the true
  // tangents from the tip to the circle; meeting the rim at an eyeballed angle
  // leaves a visible kink where the line joins the arc.
  teardrop: (() => {
    const r = R * 0.62,
      cy = C + R - r,
      ty = C - R;
    const b = Math.acos(r / (cy - ty));
    const p = (s) => [C + s * r * Math.sin(b), cy - r * Math.cos(b)];
    return `M${n(C)} ${n(ty)}L${P(p(-1))}${arc(r, r, 1, 0, p(1))}Z`;
  })(),
  egg:
    `M${n(C)} ${n(C - R)}` +
    `C${n(C + R * 0.62)} ${n(C - R)} ${n(C + R * 0.82)} ${n(C - R * 0.1)} ${n(C + R * 0.82)} ${n(C + R * 0.3)}` +
    `C${n(C + R * 0.82)} ${n(C + R * 0.78)} ${n(C + R * 0.44)} ${n(C + R)} ${n(C)} ${n(C + R)}` +
    `C${n(C - R * 0.44)} ${n(C + R)} ${n(C - R * 0.82)} ${n(C + R * 0.78)} ${n(C - R * 0.82)} ${n(C + R * 0.3)}` +
    `C${n(C - R * 0.82)} ${n(C - R * 0.1)} ${n(C - R * 0.62)} ${n(C - R)} ${n(C)} ${n(C - R)}Z`,
  // The classic parametric heart, traced. Assembling one from two arcs and two
  // cubics left the lobes meeting the cleft off-tangent, which reads as a dent.
  heart: fit(
    Array.from({ length: 65 }, (_, i) => {
      const a = (2 * Math.PI * i) / 64;
      return [
        16 * Math.sin(a) ** 3,
        -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
      ];
    }),
  ),
  angle: ANGLE.d,
};

/** Miter goes on the glyphs whose corners are meant to be points. Every other
 *  shape keeps the set's round joins: on a curved outline a miter join at a cusp
 *  can exceed the miter limit, and the renderer then draws a bevel with nothing
 *  in the output to say so. */
const MITER = new Set([
  'triangle',
  'right-triangle',
  'square',
  'rectangle',
  'diamond',
  'parallelogram',
  'trapezoid',
  'kite',
  'pentagon',
  'hexagon',
  'hexagon-flat',
  'heptagon',
  'octagon',
  'decagon',
  'dodecagon',
  'cross',
  'l-shape',
  'chevron',
  'star',
  'star-4',
  'star-6',
  'star-8',
  'pentagram',
]);
const EVENODD = new Set(['ring', 'pentagram']);
/** The wedge, not the strokes: `angle` is the one glyph whose fill is not its
 *  own outline. */
const OWN_FILL = { angle: ANGLE.fill };

export const SHAPES = Object.fromEntries(
  Object.entries(RAW).map(([key, raw]) => {
    // The fit is computed once and applied to the stroke and the fill alike.
    // Placing a glyph's fill on its own bounding box would scale it differently
    // from the strokes it is meant to sit behind.
    const b = bbox(raw);
    const k = Math.min(BOX / (b.w || BOX), BOX / (b.h || BOX));
    const ox = CENTER - b.cx * k,
      oy = CENTER - b.cy * k;
    const d = transform(raw, k, ox, oy);
    const own = OWN_FILL[key];
    const fill = own
      ? transform(own, k, ox, oy)
      : isClosed(d)
        ? d
        : underFill(d, b.y1 * k + oy, HALF_STROKE);
    return [
      `shape-${key}`,
      {
        d,
        fill,
        rule: EVENODD.has(key) ? 'evenodd' : undefined,
        join: MITER.has(key) ? 'miter' : undefined,
      },
    ];
  }),
);
