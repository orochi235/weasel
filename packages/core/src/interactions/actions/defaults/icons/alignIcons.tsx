/**
 * @experimental
 * Default align icons shipped with `defaultAlignActions`. 16x16 viewBox;
 * shapes use `fill="currentColor"` and the axis line uses
 * `stroke="currentColor"` so the whole icon themes via CSS color. Stroke
 * width 1 matches the visual weight of the 20x20 Pathfinder icons at
 * 16x16 scale.
 */
const SVG_BASE = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'currentColor',
  'aria-hidden': true,
};

const AXIS = {
  stroke: 'currentColor',
  strokeWidth: 1,
  fill: 'none',
};

export function AlignLeftIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="2" x2="2" y2="14" {...AXIS} />
      <rect x="2.5" y="3" width="9" height="3" />
      <rect x="2.5" y="9" width="6" height="3" />
    </svg>
  );
}

export function AlignRightIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="14" y1="2" x2="14" y2="14" {...AXIS} />
      <rect x="4.5" y="3" width="9" height="3" />
      <rect x="7.5" y="9" width="6" height="3" />
    </svg>
  );
}

export function AlignTopIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="2" x2="14" y2="2" {...AXIS} />
      <rect x="3" y="2.5" width="3" height="9" />
      <rect x="9" y="2.5" width="3" height="6" />
    </svg>
  );
}

export function AlignBottomIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="14" x2="14" y2="14" {...AXIS} />
      <rect x="3" y="4.5" width="3" height="9" />
      <rect x="9" y="7.5" width="3" height="6" />
    </svg>
  );
}

export function AlignCenterXIcon() {
  // Center horizontally — rectangles share a vertical center axis (x = 8).
  return (
    <svg {...SVG_BASE}>
      <line x1="8" y1="2" x2="8" y2="14" {...AXIS} />
      <rect x="3.5" y="3" width="9" height="3" />
      <rect x="5" y="9" width="6" height="3" />
    </svg>
  );
}

export function AlignCenterYIcon() {
  // Center vertically — rectangles share a horizontal center axis (y = 8).
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="8" x2="14" y2="8" {...AXIS} />
      <rect x="3" y="3.5" width="3" height="9" />
      <rect x="9" y="5" width="3" height="6" />
    </svg>
  );
}
