// Cursor glyphs: filled silhouettes on a 24-unit box, composed so the hotspot
// falls on the point the tool acts at. Distinct from the toolbar icon sets,
// which are `fill: none` outlines centred in their box.
//
// Geometry is computed, not eyeballed — see CLAUDE.md ("Drawing icons").

const n = (v) => Math.round(v * 100) / 100;

// ── pencil ───────────────────────────────────────────────────────────────
// The register-proof shape, translated +2 on both axes so 1.3 units of halo
// clear the box. Tip at (5,19) is the hotspot.
const pencil = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 7.5 16.5 L 16 8 L 19 11 L 10.5 19.5 L 8 19 Z' },
    { role: 'detail', d: 'M 14 6 L 19 11', width: 1.2 },
  ],
};

// ── pen ──────────────────────────────────────────────────────────────────
// A nib: two edges meeting at the tip, with a slit up the centre. The slit is
// `detail` so it reads as a division rather than a second silhouette. It is
// thin and stops short of the tip on purpose — at 1.2 wide with a round cap it
// blew a white hole through the nib at 24px while looking correct at 11x.
const pen = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 8.5 9.5 L 13 5 L 18 10 L 13.5 14.5 Z' },
    { role: 'detail', d: 'M 8.4 13.9 L 12.2 10.1', width: 0.9 },
  ],
};

// ── bucket ───────────────────────────────────────────────────────────────
// Parked. Three attempts failed to read at 24px: a plain tapered pail is a
// pencil silhouette, and the handle that would fix it needs geometry worth
// sketching rather than guessing. No fill tool consumes it yet, so it is not
// holding anything up. The `stroke` role it drove is kept — the rotate cursor
// needs it.

// ── eyedropper ───────────────────────────────────────────────────────────
// Bulb upper-right, narrow stem to a tip at lower-left. The bulb is a real
// disc, not a squared cap: with a cap it reads as a pencil ferrule and the
// whole glyph becomes the pencil at cursor size.
const circle = (cx, cy, r) =>
  `M ${n(cx)} ${n(cy - r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy + r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy - r)} Z`;
const eyedropper = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 6.8 14.8 L 14.4 7.2 L 16.8 9.6 L 9.2 17.2 Z' },
    { role: 'ink', d: circle(18.2, 5.8, 3.2) },
  ],
};

// ── brush ────────────────────────────────────────────────────────────
// One ring and nothing else. The ring IS the brush's extent, so `radius` names
// it and a world-sized spec scales the glyph until the ring measures the
// radius the tool asked for.
//
// No centre mark: geometry scales with the ring, so any mark large enough to
// see on a 20px brush is a quarter of the width of a 400px one. The hotspot
// is the centre, which is what every painting app relies on too.
//
// Sized so the halo lands exactly on the box edge: a 1.6 ink ring carries
// 4.2 of halo, 2.1 proud, and 12 - 2.1 is 9.9.
const BRUSH_R = 9.9;
const brush = {
  box: 24,
  hotspot: [12, 12],
  radius: BRUSH_R,
  paths: [{ role: 'stroke', d: circle(12, 12, BRUSH_R), width: 1.6 }],
};

export const DRAW = { pencil, pen, eyedropper, brush };
