// Shape-tool cursor glyphs: a crosshair with a badge naming the shape.
//
// rect, ellipse, line, star and polygon are all bare `crosshair` today, so the
// five tools are indistinguishable while you are using them. The crosshair is
// what stays the same — it is still the thing you aim with, and its centre is
// still the hotspot — and the badge is what tells them apart.
//
// The badge is a filled silhouette, not an outline. At true cursor size it is
// about 8 device pixels across; an outline at that size is a ring of single
// pixels around a hole, and the shapes stop being distinguishable from each
// other before they stop being visible.
//
// Geometry is computed, not eyeballed — see CLAUDE.md ("Drawing icons").

const n = (v) => Math.round(v * 100) / 100;

const BOX = 24;
// Crosshair centre, up and left of the box centre to leave the badge a corner.
const CX = 9;
const ARM_IN = 2.6;   // gap half-width, so the aiming point stays visible
const ARM_OUT = 7.4;  // arm length from the centre
const ARM_W = 1.6;

/** The four arms. One path each: a cross drawn as two crossing lines would
 *  put ink over the aiming point the gap exists to keep clear. */
const crosshair = () =>
  [
    [CX - ARM_OUT, CX, CX - ARM_IN, CX],
    [CX + ARM_IN, CX, CX + ARM_OUT, CX],
    [CX, CX - ARM_OUT, CX, CX - ARM_IN],
    [CX, CX + ARM_IN, CX, CX + ARM_OUT],
  ].map(([x1, y1, x2, y2]) => ({
    role: 'stroke',
    d: `M ${n(x1)} ${n(y1)} L ${n(x2)} ${n(y2)}`,
    width: ARM_W,
  }));

// Badge, lower-right. Centred where the two crosshair arms leave room, and
// sized so its halo stops short of the box edge.
const BX = 17.6;
const BY = 17.6;

const polar = (cx, cy, r, deg) => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy + r * Math.sin((deg * Math.PI) / 180),
];

const closed = (pts) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${n(x)} ${n(y)}`).join(' ') + ' Z';

/** Regular polygon with `sides` vertices, first vertex pointing up. */
const regular = (cx, cy, r, sides) =>
  closed(Array.from({ length: sides }, (_, i) => polar(cx, cy, r, -90 + (360 * i) / sides)));

/** Alternating outer/inner vertices, first point up. */
const star = (cx, cy, outer, inner, points) =>
  closed(
    Array.from({ length: points * 2 }, (_, i) =>
      polar(cx, cy, i % 2 === 0 ? outer : inner, -90 + (180 * i) / points),
    ),
  );

const circle = (cx, cy, r) =>
  `M ${n(cx)} ${n(cy - r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy + r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy - r)} Z`;

const square = (cx, cy, half) =>
  closed([
    [cx - half, cy - half],
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
  ]);

const withBadge = (badge) => ({
  box: BOX,
  hotspot: [CX, CX],
  paths: [...crosshair(), badge],
});

// A square reads as "rectangle" at badge size; a 3:2 oblong at 8px reads as a
// smear. Same reason the ellipse badge is a circle.
const crosshairRect = withBadge({ role: 'ink', d: square(BX, BY, 3.4) });
const crosshairEllipse = withBadge({ role: 'ink', d: circle(BX, BY, 3.7) });
// Five sides, not six. A hexagon badge at 24px is seven pixels across and
// reads as the ellipse badge; a pentagon's flat base and single apex survive.
const crosshairPolygon = withBadge({ role: 'ink', d: regular(BX, BY, 4.1, 5) });
const crosshairStar = withBadge({ role: 'ink', d: star(BX, BY, 4.2, 1.9, 5) });
// The one badge that is a line rather than an area — an area badge would say
// "filled shape", which is what this tool is not.
const crosshairLine = withBadge({
  role: 'stroke',
  d: `M ${n(BX - 3.4)} ${n(BY + 3.4)} L ${n(BX + 3.4)} ${n(BY - 3.4)}`,
  width: 2.2,
});

export const SHAPES = {
  crosshairRect,
  crosshairEllipse,
  crosshairLine,
  crosshairStar,
  crosshairPolygon,
};
