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
 * Hold handle angle: a handle knob on the line out of its anchor, with an
 * arrowhead saying it only slides along that line.
 *
 * @experimental
 */
export function HoldHandleAngleIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M5 15 L16 4" />
      <path d="M12 4 H16 V8" />
      <circle cx="10.5" cy="9.5" r="1.75" fill="currentColor" stroke="none" />
      <rect x="3.5" y="13.5" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Hold handle length: a handle from its anchor to a knob on the circle it
 * keeps to, so it only turns.
 *
 * @experimental
 */
export function HoldHandleLengthIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="10" cy="10" r="6.5" strokeWidth={1} />
      <path d="M10 10 L14.5962 5.4038" />
      <circle cx="14.5962" cy="5.4038" r="1.75" fill="currentColor" stroke="none" />
      <rect x="8.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none" />
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

/**
 * Harmonize curvature: a smooth arch through its anchor, with comb teeth of
 * one length standing out of it.
 *
 * @experimental
 */
export function HarmonizeIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 16 C3 9 6.5 6 10 6 S17 9 17 16" />
      <path d="M4.02 7.43 L2.47 6.18 M10 3.5 V1.5 M15.98 7.43 L17.53 6.18" strokeWidth={1} />
      <rect x="8.5" y="4.5" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Average anchors: three anchors with spokes in to the anchor at their mean.
 *
 * @experimental
 */
export function AverageAnchorsIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M5.6 5.6 L7.6 7.6 M14.4 5.6 L12.4 7.6 M10 14.4 V12.5" strokeWidth={1.25} />
      <rect x="2.875" y="2.875" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14.125" y="2.875" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="8.5" y="14.125" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="8.125" y="8.125" width="3.75" height="3.75" strokeWidth={1.25} />
    </svg>
  );
}

/**
 * Bend segment: a straight segment, dashed, pulled up into a curve.
 *
 * @experimental
 */
export function BendSegmentIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3.5 15 H16.5" strokeWidth={1} strokeDasharray="1.4 1.4" />
      <path d="M3.5 15 Q10 3 16.5 15" />
      <path d="M10 12.5 V10 M8.8 11.2 L10 10 L11.2 11.2" strokeWidth={1} />
      <rect x="2" y="13.5" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="15" y="13.5" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
