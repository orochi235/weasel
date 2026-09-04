// Transform-handle cursor glyphs: the pair the affordance layer bakes at an
// angle. Both are centred on the box and hotspotted at its centre, because
// both answer "which way does this axis run" rather than "where does the tool
// bite" — a rotated arrow with an off-centre hotspot points from its tail.
//
// Everything here must clear `rotationFitsInBox`: bake rotates about the box
// centre in a viewBox that does not grow, so geometry outside the inscribed
// circle is sheared off at some angles and not others.
//
// Geometry is computed, not eyeballed — see CLAUDE.md ("Drawing icons").

const n = (v) => Math.round(v * 100) / 100;
const C = 12;
const BOX = 24;

/** Triangle with its base centred on (x,y) and its apex `len` along `(dx,dy)`. */
const head = (x, y, dx, dy, len, half) => {
  const ax = x + dx * len;
  const ay = y + dy * len;
  const px = -dy * half;
  const py = dx * half;
  return `M ${n(ax)} ${n(ay)} L ${n(x + px)} ${n(y + py)} L ${n(x - px)} ${n(y - py)} Z`;
};

// ── resize ───────────────────────────────────────────────────────────────
// A double-headed straight arrow, horizontal at angle 0, so the baked angle
// IS the direction the resize axis runs. One polygon rather than a shaft plus
// two triangles: separate members leave a halo seam where they meet, and the
// seam is a white notch through the shaft at 16px.
const TIP = 9.5;      // half-length; also the glyph's outer radius
const HEAD_LEN = 4.5;
const HEAD_HALF = 3.2;
const SHAFT_HALF = 1.3;
const resize = (() => {
  const backX = TIP - HEAD_LEN;             // x-offset of each head's base
  const pts = [
    [-TIP, 0],
    [-backX, -HEAD_HALF],
    [-backX, -SHAFT_HALF],
    [backX, -SHAFT_HALF],
    [backX, -HEAD_HALF],
    [TIP, 0],
    [backX, HEAD_HALF],
    [backX, SHAFT_HALF],
    [-backX, SHAFT_HALF],
    [-backX, HEAD_HALF],
  ];
  const d =
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${n(C + x)} ${n(C + y)}`).join(' ') + ' Z';
  return { box: BOX, hotspot: [C, C], paths: [{ role: 'ink', d }] };
})();

// ── rotate ───────────────────────────────────────────────────────────────
// A shallow arc bulging upward, with a head at each end continuing the sweep,
// so it reads as "turn either way" rather than as a one-way arrow. The heads
// are `ink` and the arc is `stroke`: the arc is a wire, and filling it would
// close the ring.
//
// The sweep is 140° and not more. Past about 180° the two heads converge on
// the bottom of the circle and the glyph reads as a horseshoe; a shallow arc
// with the heads flaring outward is what every editor's rotate cursor is.
//
// The arc and heads are heavy for their radius because at 16 CSS px on a 1x
// display the whole glyph gets 16 device pixels: at the weights the 11x sheet
// flatters, both heads vanish and it reads as a plain hook.
const R = 6.6;
const ARC_FROM = 200;                       // screen degrees, y down
const ARC_TO = 340;                         // reached by sweeping over the top
const ARC_W = 2.8;
const HEAD = 4.6;
const HEAD_W = 3;
const rotate = (() => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const at = (deg) => [C + R * Math.cos(rad(deg)), C + R * Math.sin(rad(deg))];
  const [sx, sy] = at(ARC_FROM);
  const [ex, ey] = at(ARC_TO);
  // Increasing angle is a positive sweep; under 180° the large-arc flag is 0.
  const arc = `M ${n(sx)} ${n(sy)} A ${R} ${R} 0 0 1 ${n(ex)} ${n(ey)}`;
  // Each head continues past its end of the sweep — the start backwards, the
  // finish forwards — which flares them down and outward.
  const tangent = (deg, forward) => {
    const s = forward ? 1 : -1;
    return [-s * Math.sin(rad(deg)), s * Math.cos(rad(deg))];
  };
  const [bx, by] = tangent(ARC_FROM, false);
  const [fx, fy] = tangent(ARC_TO, true);
  return {
    box: BOX,
    hotspot: [C, C],
    paths: [
      { role: 'stroke', d: arc, width: ARC_W },
      { role: 'ink', d: head(sx, sy, bx, by, HEAD, HEAD_W) },
      { role: 'ink', d: head(ex, ey, fx, fy, HEAD, HEAD_W) },
    ],
  };
})();

export const TRANSFORM = { resize, rotate };
