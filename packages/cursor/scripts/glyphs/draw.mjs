// Cursor glyphs: filled silhouettes on a 24-unit box, composed so the hotspot
// falls on the point the tool acts at. Distinct from the toolbar icon sets,
// which are `fill: none` outlines centered in their box.
//
// Geometry is computed, not eyeballed — see docs/icons.md ("Drawing rules").

import { circle } from './lib.mjs';

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
// A nib: two edges meeting at the tip, with a slit up the center. The slit is
// `detail` so it reads as a division rather than a second silhouette. It is
// thin and stops short of the tip on purpose — at 1.2 wide with a round cap it
// blew a white hole through the nib at 24px while looking correct at 11x.
//
// Marked (inserting an anchor is `{ glyph: 'pen', mark: 'add' }`), the nib has
// to be the same nib, or it reads as a different tool. It runs along the
// anti-diagonal, occupying the band 18 <= x + y <= 28 and leaving nothing on
// the diagonal for a mark, so it moves 2 up and 2 left, dropping the band to
// 14..24. The mark then centers on the diagonal at 17.5: its nearest tips sit
// at x + y = 31, 4.95 clear of the nib's 24, which is 2.35 once both halos are
// spent, and its far tips reach 21.5, inside the 22.7 the halo leaves.
const pen = {
  box: 24,
  hotspot: [5, 19],
  mark: { x: 17.5, y: 17.5, size: 10, shift: [-2, -2] },
  paths: [
    { role: 'ink', d: 'M 5 19 L 8.5 9.5 L 13 5 L 18 10 L 13.5 14.5 Z' },
    { role: 'detail', d: 'M 8.4 13.9 L 12.2 10.1', width: 0.9 },
  ],
};

// ── eyedropper ───────────────────────────────────────────────────────────
// Bulb upper-right, narrow stem to a tip at lower-left. The bulb is a real
// disc, not a squared cap: with a cap it reads as a pencil ferrule and the
// whole glyph becomes the pencil at cursor size.
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
// No center mark: geometry scales with the ring, so any mark large enough to
// see on a 20px brush is a quarter of the width of a 400px one. The hotspot
// is the center, which is what every painting app relies on too.
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
