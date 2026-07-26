/**
 * @experimental
 * Default distribute icons shipped with `defaultDistributeActions`. Three
 * rectangles with visually equal gaps — the implied even-spacing is the
 * glyph. 16x16 viewBox, `fill="currentColor"` for theming via CSS.
 */
const SVG_BASE = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'currentColor',
  'aria-hidden': true,
};

export function DistributeHorizontalIcon() {
  // Three 3-wide rects with 2.5-unit gaps between them.
  return (
    <svg {...SVG_BASE}>
      <rect x="1" y="4" width="3" height="8" />
      <rect x="6.5" y="4" width="3" height="8" />
      <rect x="12" y="4" width="3" height="8" />
    </svg>
  );
}

export function DistributeVerticalIcon() {
  // Three 3-tall rects stacked with 2.5-unit gaps between them.
  return (
    <svg {...SVG_BASE}>
      <rect x="4" y="1" width="8" height="3" />
      <rect x="4" y="6.5" width="8" height="3" />
      <rect x="4" y="12" width="8" height="3" />
    </svg>
  );
}
