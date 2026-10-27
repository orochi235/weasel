// The mind map topics: a central oval with a heavy label, a rounded main topic, a stadium
// subtopic, and a note with its corner folded, as the `note` outline draws it.

import { P, at, line, n, roundRect } from './grid.mjs';

const BOLD = 2.5;

// Four circular arcs through the box's extremes: sides of radius `side`, and top and bottom of the radius
// that meets them at a tangent. Flatter across the top than an ellipse of the same box, which at 16px 1x
// stepped through gray on every side; this one holds solid rows and columns at its extremes.
function oval(cx, cy, rx, ry, side) {
  const top = ((rx - side) ** 2 + ry ** 2 - side ** 2) / (2 * (ry - side));
  const topY = cy - ry + top;
  const d = Math.hypot(rx - side, cy - topY);
  const x = cx + ((rx - side) / d) * top;
  const y = topY + ((cy - topY) / d) * top;
  const arc = (r, px, py) => `A${n(r)} ${n(r)} 0 0 1 ${P(px, py)}`;
  return `M${P(2 * cx - x, y)}${arc(top, x, y)}${arc(side, x, 2 * cy - y)}${arc(top, 2 * cx - x, 2 * cy - y)}${arc(side, 2 * cx - x, y)}Z`;
}

const centralTopic = (() => {
  const shape = oval(10, 10, at(13), at(9), at(6));
  return { d: shape, fill: shape, inner: { d: line(at(10), at(16), at(22), at(16)), width: BOLD } };
})();

const mainTopic = (() => {
  const card = roundRect(at(3), at(9), at(29), at(25), at(3));
  return { d: card + line(at(9), at(17), at(23), at(17)), fill: card };
})();

const subtopic = (() => {
  const h = at(23) - at(11);
  const pill = roundRect(at(5), at(11), at(27), at(23), h / 2);
  return { d: pill + line(at(11), at(17), at(21), at(17)), fill: pill };
})();

const floatingNote = (() => {
  const l = at(7), t = at(5), r = at(25), b = at(27), f = at(6);
  const sheet = `M${P(l, t)}H${n(r - f)}L${P(r, t + f)}V${n(b)}H${n(l)}Z`;
  const fold = `M${P(r - f, t)}V${n(t + f)}H${n(r)}`;
  return { d: sheet + fold + line(at(11), at(15), at(21), at(15)) + line(at(11), at(21), at(19), at(21)), fill: sheet };
})();

/** The mind map type itself: a central topic with a branch out to an underlined topic at each corner. Each branch
 *  leaves the hub's corner along its normal at 45 degrees; leaving a side tangent to it, the four merged into the
 *  hub's walls at 16px. */
const mindMap = (() => {
  const hub = roundRect(at(11), at(13), at(21), at(19), at(2));
  const k = Math.SQRT1_2 * at(2);
  const branch = (sx, sy) => {
    const x0 = 10 + sx * (at(19) - 10 + k);
    const y0 = at(16) + sy * (at(1) + k);
    const y1 = at(16) + sy * at(9);
    const x1 = x0 + sx * Math.abs(y1 - y0);
    return `M${P(x0, y0)}L${P(x1, y1)}H${n(10 + sx * (at(30) - 10))}`;
  };
  return { d: hub + branch(1, -1) + branch(1, 1) + branch(-1, -1) + branch(-1, 1), fill: hub };
})();

export const MIND_MAP = {
  'central-topic': centralTopic, 'main-topic': mainTopic, subtopic, 'floating-note': floatingNote, 'mind-map': mindMap,
};
