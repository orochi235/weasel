// Cursor marks: what a tool does, set in the slot a base glyph leaves for one
// (a crosshair's lower right, the pen's far corner). The cursor register's
// counterpart of ui's `mark-*` icons, and drawn to the same names where they
// overlap, but as filled silhouettes: at true cursor size a mark is about 8
// device pixels across, and an outline that small is a ring of single pixels
// around a hole.
//
// Each is centered in a 10-unit box, which a slot of size 10 places at the
// glyph's own scale.
//
// Geometry is computed, not eyeballed — see docs/icons.md ("Drawing rules").

import { circle, closed, n, polar } from './lib.mjs';

const BOX = 10;
const C = BOX / 2;

/** Regular polygon with `sides` vertices, first vertex pointing up. */
const regular = (r, sides) =>
  closed(Array.from({ length: sides }, (_, i) => polar(C, C, r, -90 + (360 * i) / sides)));

/** Alternating outer/inner vertices, first point up. */
const starD = (outer, inner, points) =>
  closed(
    Array.from({ length: points * 2 }, (_, i) =>
      polar(C, C, i % 2 === 0 ? outer : inner, -90 + (180 * i) / points),
    ),
  );

/** A filled cross, not two crossed bars, so the center is not a halo seam. */
const cross = (arm, half) =>
  closed([
    [C - half, C - arm], [C + half, C - arm], [C + half, C - half],
    [C + arm, C - half], [C + arm, C + half], [C + half, C + half],
    [C + half, C + arm], [C - half, C + arm], [C - half, C + half],
    [C - arm, C + half], [C - arm, C - half], [C - half, C - half],
  ]);

const mark = (...paths) => ({ box: BOX, paths });

export const MARKS = {
  // Arms of 4 and a half-width of 1.4: the size the pen's plus badge was
  // proofed at.
  add: mark({ role: 'ink', d: cross(4, 1.4) }),
  remove: mark({ role: 'ink', d: closed([[C - 4, C - 1.4], [C + 4, C - 1.4], [C + 4, C + 1.4], [C - 4, C + 1.4]]) }),
  // A square reads as "rectangle" at mark size; a 3:2 oblong at 8px reads as a
  // smear. Same reason the ellipse mark is a circle.
  rect: mark({ role: 'ink', d: closed([[C - 3.4, C - 3.4], [C + 3.4, C - 3.4], [C + 3.4, C + 3.4], [C - 3.4, C + 3.4]]) }),
  ellipse: mark({ role: 'ink', d: circle(C, C, 3.7) }),
  // Five sides, not six. A hexagon at 24px is seven pixels across and reads as
  // the ellipse mark; a pentagon's flat base and single apex survive.
  polygon: mark({ role: 'ink', d: regular(4.1, 5) }),
  star: mark({ role: 'ink', d: starD(4.2, 1.9, 5) }),
  // The one mark that is a line rather than an area: an area would say
  // "filled shape", which is what the line tool does not make.
  line: mark({ role: 'stroke', d: `M ${n(C - 3.4)} ${n(C + 3.4)} L ${n(C + 3.4)} ${n(C - 3.4)}`, width: 2.2 }),
};
