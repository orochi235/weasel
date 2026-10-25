// The mind map topics: a central ellipse with a heavy label, a rounded main topic, a stadium
// subtopic, and a note with its corner folded, as the `note` outline draws it.

import { P, at, line, n, roundRect } from './grid.mjs';

const BOLD = 2.5;

const ellipse = (cx, cy, rx, ry) =>
  `M${P(cx - rx, cy)}A${n(rx)} ${n(ry)} 0 1 1 ${P(cx + rx, cy)}A${n(rx)} ${n(ry)} 0 1 1 ${P(cx - rx, cy)}Z`;

const centralTopic = (() => {
  const shape = ellipse(10, 10, at(13), at(9));
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

/** The mind map type itself: a central topic with a branch curving out to an underlined topic at each corner. */
const mindMap = (() => {
  const hub = roundRect(at(11), at(13), at(21), at(19), at(2));
  const branch = (sx, sy) => {
    const x0 = 10 + sx * (at(21) - 10);
    const y0 = at(16);
    const x1 = 10 + sx * (at(26) - 10);
    const y1 = at(16) + sy * (at(25) - at(16));
    const x2 = 10 + sx * (at(29) - 10);
    return `M${P(x0, y0)}C${P(x0 + sx * at(2), y0)} ${P(x1 - sx * at(2), y1)} ${P(x1, y1)}H${n(x2)}`;
  };
  return { d: hub + branch(1, -1) + branch(1, 1) + branch(-1, -1) + branch(-1, 1), fill: hub };
})();

export const MIND_MAP = {
  'central-topic': centralTopic, 'main-topic': mainTopic, subtopic, 'floating-note': floatingNote, 'mind-map': mindMap,
};
