/**
 * Icons for the path commands — Join, Bridge, Cut at Crossings, Simplify and
 * Offset Path — in the register of the other action glyphs: 20x20 viewBox,
 * stroked in `currentColor`. Join and Bridge share one layout so the two read
 * as a pair: the same ends, spanned straight or curved.
 */
const SVG_BASE = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const ENDS = 'M2 15.6 H6 M14 4.4 H18';
const END_ANCHORS = (
  <>
    <rect x="4.5" y="14.1" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="12.5" y="2.9" width="3" height="3" fill="currentColor" stroke="none" />
  </>
);

/**
 * Join: two open ends facing each other across a gap, spanned straight.
 *
 * @experimental
 */
export function JoinIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d={ENDS} />
      <path d="M6 15.6 L14 4.4" />
      {END_ANCHORS}
    </svg>
  );
}

/**
 * Bridge: the ends Join spans, joined instead by a curve that leaves each one
 * along its path's heading.
 *
 * @experimental
 */
export function BridgeIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d={ENDS} />
      <path d="M6 15.6 C11 15.6 9 4.4 14 4.4" />
      {END_ANCHORS}
    </svg>
  );
}

/**
 * Cut at Crossings: a path parted where another crosses it, with an anchor on
 * each new end.
 *
 * @experimental
 */
export function CutAtCrossingsIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2.5 10.625 H6 M12.75 10.625 H17.5" />
      <path d="M9.375 2.5 V17.5" />
      <rect x="4.5" y="9.125" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="11.25" y="9.125" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Simplify: a jagged run above the smooth curve that refits it, held by its
 * two end anchors.
 *
 * @experimental
 */
export function SimplifyIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 7.5 L5.5 4.5 L8 7.5 L10.5 4.5 L13 7.5 L15.5 4.5 L17 6" strokeWidth={1.25} />
      <path d="M4 15.6 C8 10.5 12 10.5 16 15.6" />
      <rect x="2.5" y="14.1" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14.5" y="14.1" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Offset Path: a shape inside the outline grown from it, its corners rounded
 * out by the offset.
 *
 * @experimental
 */
export function OffsetPathIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="6.875" y="6.875" width="6.25" height="6.25" rx="1" />
      <rect x="3.125" y="3.125" width="13.75" height="13.75" rx="4.75" strokeWidth={1.25} />
    </svg>
  );
}
