/**
 * Icons for the anchor-handle commands, in the register of the other action
 * glyphs: 20x20 viewBox, stroked in `currentColor`.
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

/**
 * Retract handles: a sharp corner on its anchor, with the handle stubs
 * either side pointing in toward it.
 *
 * @experimental
 */
export function RetractHandlesIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 17 L10 7 L17 17" />
      <path d="M2.5 5 H6.5 M5 3.5 L6.5 5 L5 6.5" strokeWidth={1} />
      <path d="M17.5 5 H13.5 M15 3.5 L13.5 5 L15 6.5" strokeWidth={1} />
      <rect x="8.5" y="5.5" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Make handles symmetric: a smooth curve through its anchor, with one handle
 * line across it ending in two equal knobs.
 *
 * @experimental
 */
export function SymmetricHandlesIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 17 C3 10 6 8 10 8 S17 10 17 17" />
      <path d="M3.5 8 H16.5" strokeWidth={1} />
      <circle cx="3.5" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <rect x="8.5" y="6.5" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Simplify brush: a smooth curve with a brush ring over its crest, the stretch
 * the brush would thin.
 *
 * @experimental
 */
export function SimplifyBrushIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2 16 C5 6 15 6 18 16" />
      <circle cx="10" cy="8.5" r="5" strokeWidth={1} strokeDasharray="2 1.5" />
    </svg>
  );
}
