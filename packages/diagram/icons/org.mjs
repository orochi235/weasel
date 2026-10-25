// The org chart cards. A person is a rounded card holding a name over a title; an executive is a
// bigger card whose name is heavier; an assistant hangs off a reporting line on a short stub, as it
// does in a chart; a vacancy is a person card drawn broken; a department is a square-cornered box with one line.

import { at, line, n, P, rect, roundRect } from './grid.mjs';

const R = at(3);
const BOLD = 2.5;

const person = (() => {
  const card = roundRect(at(5), at(9), at(27), at(23), R);
  return { d: card + line(at(9), at(13), at(23), at(13)) + line(at(11), at(19), at(21), at(19)), fill: card };
})();

const executive = (() => {
  const card = roundRect(at(3), at(7), at(29), at(25), R);
  return {
    d: card + line(at(11), at(19), at(21), at(19)),
    fill: card,
    inner: { d: line(at(8), at(12), at(24), at(12)), width: BOLD },
  };
})();

const assistant = (() => {
  const card = roundRect(at(13), at(9), at(29), at(21), R);
  const spine = line(at(5), at(3), at(5), at(29));
  const stub = line(at(5), at(15), at(13), at(15));
  return { d: spine + stub + card + line(at(17), at(15), at(25), at(15)), fill: card };
})();

/** A position nobody holds yet: the person card's corners and a dash down each side, its name line alone. */
const vacancy = (() => {
  const [l, t, r, b, g] = [at(5), at(9), at(27), at(23), at(2)];
  const a = (x, y) => `A${n(R)} ${n(R)} 0 0 1 ${P(x, y)}`;
  const corners = `M${P(l, t + R + g)}V${n(t + R)}${a(l + R, t)}H${n(l + R + g)}`
    + `M${P(r - R - g, t)}H${n(r - R)}${a(r, t + R)}V${n(t + R + g)}`
    + `M${P(r, b - R - g)}V${n(b - R)}${a(r - R, b)}H${n(r - R - g)}`
    + `M${P(l + R + g, b)}H${n(l + R)}${a(l, b - R)}V${n(b - R - g)}`;
  const dashes = line(at(14), t, at(18), t) + line(at(14), b, at(18), b);
  return { d: corners + dashes + line(at(11), at(15), at(21), at(15)), fill: roundRect(l, t, r, b, R) };
})();

const department = (() => {
  const box = rect(at(5), at(9), at(27), at(25));
  return { d: box + line(at(9), at(17), at(23), at(17)), fill: box, join: 'miter' };
})();

/** The org chart type itself: one box over two, joined by a bus. */
const orgChart = (() => {
  const boxes = rect(at(11), at(3), at(23), at(9)) + rect(at(3), at(23), at(11), at(29)) + rect(at(21), at(23), at(29), at(29));
  const bus = line(at(17), at(9), at(17), at(17)) + line(at(7), at(17), at(25), at(17))
    + line(at(7), at(17), at(7), at(23)) + line(at(25), at(17), at(25), at(23));
  return { d: boxes + bus, fill: boxes, join: 'miter' };
})();

export const ORG = { person, executive, assistant, vacancy, department, 'org-chart': orgChart };
