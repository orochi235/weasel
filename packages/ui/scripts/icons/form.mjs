// What a settings form is built from, as PrefSchemaEditor's palette offers
// them: the ways a group is drawn, and a label.
//
// The three framed ones share one 13.5 x 11.5 box, so what tells them apart is
// only what the form itself adds: a page gets a rail down its side, a tab
// rises out of the box's top edge, a panel carries its title inside.
// Rules inside the box sit at 8.1 and not 8: at 16px a unit is 0.8 device
// pixels, and 8.1 lands the stroke on one pixel row where 8 straddles two.
const L = 3.25;
const T = 4.25;
const W = 13.5;
const H = 11.5;
const R = 1.5;
const RIGHT = L + W; // 16.75
const BOTTOM = T + H; // 15.75
const frame = `<rect x="${L}" y="${T}" width="${W}" height="${H}" rx="${R}"/>`;

// The tab's own top is the frame's; the body starts where the tab ends.
const TAB_RIGHT = 9.5;
const BODY_TOP = 8.1;
const tabbed =
  `M${L + R} ${BOTTOM}a${R} ${R} 0 0 1 ${-R} ${-R}V${T + R}a${R} ${R} 0 0 1 ${R} ${-R}` +
  `H${TAB_RIGHT - R}a${R} ${R} 0 0 1 ${R} ${R}V${BODY_TOP}` +
  `H${RIGHT - R}a${R} ${R} 0 0 1 ${R} ${R}V${BOTTOM - R}a${R} ${R} 0 0 1 ${-R} ${R}Z`;

// A tag: the body's left edge runs to a point at the box's mid-height.
const TAG_TOP = 5.5;
const TAG_BOTTOM = 14.5;
const TAG_NECK = 8;
const tag =
  `M${TAG_NECK} ${TAG_TOP}H${RIGHT - R}a${R} ${R} 0 0 1 ${R} ${R}V${TAG_BOTTOM - R}` +
  `a${R} ${R} 0 0 1 ${-R} ${R}H${TAG_NECK}L${L} ${(TAG_TOP + TAG_BOTTOM) / 2}Z`;

// A bar is the frame cut down to one line's height. Its edges and its middle
// are placed for 16px, as the rules above are: each lands on one pixel row,
// with five rows inside, so the rule through the middle has a row of its own.
const BAR_TOP = 6.75;
const BAR_H = 7.75;
const BAR_MID = BAR_TOP + BAR_H / 2; // 10.625

export const FORM = {
  // Rail and pane.
  formPage: `${frame}<path d="M8.1 ${T}V${BOTTOM}"/>`,

  // The picked tab joined to its body, and the next tab's name beside it.
  formTab: `<path d="${tabbed}"/><path d="M12 5.35h3.5"/>`,

  // A box with its title in it.
  formPanel: `${frame}<path d="M6 8.1h4.5"/>`,

  // A heading, heavier than the rows under it; each row a name and a control.
  formSection: `
    <path d="M3.75 5.5h6.5" stroke-width="2.25"/>
    <path d="M3.75 10.5h3M9.75 10.5h6.5M3.75 14.5h3M9.75 14.5h6.5"/>`,

  // One line: a button, a divider, and a field.
  formBar: `
    <rect x="${L}" y="${BAR_TOP}" width="${W}" height="${BAR_H}" rx="${R}"/>
    <path d="M8.1 ${BAR_TOP}V${BAR_TOP + BAR_H}M10.75 ${BAR_MID}h3.5"/>
    <circle cx="5.7" cy="${BAR_MID}" r="1" fill="currentColor" stroke="none"/>`,

  formLabel: `<path d="${tag}"/><circle cx="8.75" cy="10" r="1.1" fill="currentColor" stroke="none"/>`,
};
