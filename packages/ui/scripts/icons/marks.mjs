import { onCircle } from './base.mjs';

// Marks: what `<Icon mark>` sets in a corner of another glyph, to say what a
// press does with it. Each is a glyph like any other and draws alone at full
// size, but is drawn to be read at half of it: one gesture, filling the
// frame, with no detail a slot's few pixels could not hold.
//
// A mark carries no stroke-width of its own. The slot scales the mark down
// and its stroke back up by the same factor, so the mark lands at the weight
// of the glyph it sits on; a width written here would be scaled down with it.

const C = 10;
// Half the span of a straight mark, cap centers.
const REACH = 6.5;
const round2 = (v) => Math.round(v * 100) / 100;

// The cross's arms end on the same circle the plus's do.
const DIAG = round2(REACH / Math.SQRT2);

// `check`'s legs at the same angles and ratio, sized so the longer one spans
// what the plus does, and centered on its bounding box the same way.
const SHORT = onCircle(0, 0, 5.9, 135);
const LONG = onCircle(0, 0, 13, 48);
const mid = [(SHORT[0] + LONG[0]) / 2, LONG[1] / 2];
const at = ([x, y]) => `${round2(x + C - mid[0])} ${round2(y + C - mid[1])}`;

// An arrowhead on the vertical stem: two legs back from the tip, `dir` 1 pointing down.
const HEAD = 5.5;
const head = (dir) => {
  const tip = C + dir * REACH;
  return `M${C - HEAD} ${tip - dir * HEAD} ${C} ${tip} ${C + HEAD} ${tip - dir * HEAD}`;
};

const pt = ([x, y]) => `${round2(x)} ${round2(y)}`;
// A solid head: two stroked legs close up into a blob under a slot's stroke. Its base is the radius through the
// arc's end, and its tip lies ahead of that end along the tangent, so the arc runs into the middle of the base.
const RESET_R = 6;
const RESET_CY = C + 0.5;
const RESET_END = 45;
const RESET_FROM = onCircle(C, RESET_CY, RESET_R, 130);
const RESET_TO = onCircle(C, RESET_CY, RESET_R, RESET_END);
const HEAD_HALF = 3.2;
const HEAD_LONG = 5;
const rad = (RESET_END * Math.PI) / 180;
// Screen y runs down: outward along the radius, and onward along the counterclockwise tangent.
const out = [Math.cos(rad), -Math.sin(rad)];
const on = [-Math.sin(rad), -Math.cos(rad)];
const resetHead = [
  [RESET_TO[0] + out[0] * HEAD_HALF, RESET_TO[1] + out[1] * HEAD_HALF],
  [RESET_TO[0] + on[0] * HEAD_LONG, RESET_TO[1] + on[1] * HEAD_LONG],
  [RESET_TO[0] - out[0] * HEAD_HALF, RESET_TO[1] - out[1] * HEAD_HALF],
];

// Three strokes through the center, their six ends on the circle the plus's arms end on.
const spoke = (deg) => `M${pt(onCircle(C, C, REACH, deg))} ${pt(onCircle(C, C, REACH, deg + 180))}`;
const asterisk = [90, 30, 150].map(spoke).join('');

// As wide a ring as leaves the slash's ends clear of it: at a slot's size a smaller one closes up around the slash.
const NONE_R = 5.5;

const star = `M${Array.from({ length: 10 }, (_, i) => pt(onCircle(C, C + 0.5, i % 2 ? 2.9 : 6.5, 90 + i * 36))).join(' ')}Z`;

// `side` 1 draws the figure as written and -1 mirrors it across the frame's center line.
const mx = (side, x) => (side === 1 ? x : 2 * C - x);

// Undo and redo: a run out from a solid head, hooked back under itself.
const hook = (side) => {
  const x = (v) => mx(side, v);
  return (
    `<path d="M${x(8)} 6.5H${x(12)}a4.5 4.5 0 0 ${side === 1 ? 1 : 0} 0 9H${x(6.5)}"/>` +
    `<path d="M${x(2)} 6.5 ${x(8)} 2.5V10.5Z" fill="currentColor" stroke="none"/>`
  );
};

// A solid triangle running into a bar, `side` 1 pointing right.
const step = (side) => {
  const x = (v) => mx(side, v);
  return `<path d="M${x(4)} 5 ${x(10.5)} ${C} ${x(4)} 15Z" fill="currentColor"/><path d="M${x(16)} 4.5v11"/>`;
};

// A chevron, `side` 1 pointing right; with `end`, it runs into a bar.
const page = (side, end = false) => {
  const x = (v) => mx(side, v);
  return end
    ? `<path d="M${x(4.5)} 4 ${x(10.5)} ${C} ${x(4.5)} 16"/><path d="M${x(16.5)} 4v12"/>`
    : `<path d="M${x(7)} 3.5 ${x(13.5)} ${C} ${x(7)} 16.5"/>`;
};

export const MARKS = {
  'mark-add': `<path d="M${C} ${C - REACH}v${2 * REACH}M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-remove': `<path d="M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-check': `<path d="M${at(SHORT)} ${at([0, 0])} ${at(LONG)}"/>`,
  'mark-close': `<path d="M${C - DIAG} ${C - DIAG} ${C + DIAG} ${C + DIAG}M${C + DIAG} ${C - DIAG} ${C - DIAG} ${C + DIAG}"/>`,
  'mark-dot': `<circle cx="${C}" cy="${C}" r="5" fill="currentColor" stroke="none"/>`,

  // A card, and the top and right edges of one behind it.
  'mark-clone': `<rect x="3.5" y="8.5" width="8" height="8" rx="1"/><path d="M8.5 3.5H15.5a1 1 0 0 1 1 1V11.5"/>`,

  // Filled, since a slot's stroke leaves no room inside a body this size.
  'mark-lock': `<rect x="4.5" y="10" width="11" height="6.5" rx="1" fill="currentColor"/><path d="M6.5 10V7a3.5 3.5 0 0 1 7 0V10"/>`,

  'mark-up': `<path d="M${C} ${C + REACH}V${C - REACH}"/><path d="${head(-1)}"/>`,
  'mark-down': `<path d="M${C} ${C - REACH}V${C + REACH}"/><path d="${head(1)}"/>`,

  'mark-reset': `<path d="M${pt(RESET_FROM)}A${RESET_R} ${RESET_R} 0 1 0 ${pt(RESET_TO)}"/><path d="M${resetHead.map(pt).join(' ')}Z" fill="currentColor" stroke="none"/>`,

  'mark-search': `<circle cx="8.5" cy="8.5" r="4.5"/><path d="M12 12 16.5 16.5"/>`,

  // The point is a stroke of no length, so its round caps draw it as wide as the stem at any scale.
  'mark-alert': `<path d="M${C} ${C - REACH}v7.5"/><path d="M${C} 16.2v.01"/>`,

  'mark-star': `<path d="${star}" fill="currentColor"/>`,

  // Every one: an asterisk.
  'mark-all': `<path d="${asterisk}"/>`,

  // Not one: a slashed O, the slash rising to the right.
  'mark-none': `<circle cx="${C}" cy="${C}" r="${NONE_R}"/><path d="M${C - REACH} ${C + REACH} ${C + REACH} ${C - REACH}"/>`,

  // A can hung from its lid, with the lid's knob: open, since a filled one reads as a block.
  'mark-delete': `<path d="M8.5 3h3M3.5 5.5h13"/><path d="M5.5 7.5 6.5 16h7l1-8.5"/>`,

  // Three rules, each shorter than the one above.
  'mark-sort': `<path d="M3.5 4.5h13M3.5 10h8.5M3.5 15.5h4"/>`,

  // A funnel: a solid mouth and a stem.
  'mark-filter': `<path d="M4.5 5h11L${C} 11.5Z" fill="currentColor"/><path d="M${C} 11.5v4.5"/>`,

  'mark-undo': hook(1),
  'mark-redo': hook(-1),

  // An arrow down onto a tray.
  'mark-export': `<path d="M${C} 3.5v4"/><path d="M4.5 6.5h11L${C} 12.5Z" fill="currentColor" stroke="none"/><path d="M3.5 16h13"/>`,

  // A camera in silhouette, the lens knocked out of it. The lens winds the way the body does, so the slot's
  // clearing, which fills by winding, has no hole in it.
  'mark-snapshot': `<path d="M4 5.5h2.5l1.5-2.5h4l1.5 2.5H16a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2zM13 11.25a3 3 0 1 1-6 0a3 3 0 1 1 6 0z" fill="currentColor" fill-rule="evenodd" stroke="none"/>`,

  // Playback: solid, where paging's chevrons are open.
  'mark-play': `<path d="M6.5 4.5 15.5 ${C} 6.5 15.5Z" fill="currentColor"/>`,
  // Two slabs in the square `mark-stop` fills.
  'mark-pause': `<rect x="6" y="6" width="1" height="8" fill="currentColor"/><rect x="13" y="6" width="1" height="8" fill="currentColor"/>`,
  'mark-stop': `<rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor"/>`,
  'mark-step-back': step(-1),
  'mark-step-forward': step(1),

  'mark-first': page(-1, true),
  'mark-prev': page(-1),
  'mark-next': page(1),
  'mark-last': page(1, true),
};
