/**
 * Icons for the outline actions, in the register of the Pathfinder icons
 * beside them: 20x20 viewBox, stroked in `currentColor`.
 */
const SVG_BASE = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
};

/**
 * Create Outlines: a letter T drawn as its outline, with anchor squares on
 * its corners — type turned into editable geometry.
 */
export function CreateOutlinesIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3.5 3.5 H16.5 V7.5 H12 V16.5 H8 V7.5 H3.5 Z" strokeLinejoin="miter" />
      <g fill="currentColor" stroke="none">
        <rect x="2" y="2" width="3" height="3" />
        <rect x="15" y="2" width="3" height="3" />
        <rect x="6.5" y="15" width="3" height="3" />
        <rect x="10.5" y="15" width="3" height="3" />
      </g>
    </svg>
  );
}

/**
 * Outline Stroke: a thick curved stroke drawn as its outline, with anchor
 * squares on its corners.
 */
export function OutlineStrokeIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M4 4 A12 12 0 0 1 16 16 H10 A6 6 0 0 0 4 10 Z" strokeLinejoin="miter" />
      <g fill="currentColor" stroke="none">
        <rect x="2.5" y="2.5" width="3" height="3" />
        <rect x="14.5" y="14.5" width="3" height="3" />
        <rect x="8.5" y="14.5" width="3" height="3" />
        <rect x="2.5" y="8.5" width="3" height="3" />
      </g>
    </svg>
  );
}
