/** Icons for the path-structure commands: direction, start, corners, segment
 *  type and extremes. */
import { anchor, SVG_BASE } from './iconBase';

/**
 * Reverse path: two runs pointing opposite ways.
 *
 * @experimental
 */
export function ReversePathIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M4.5 6.875 H15.5 M15.5 13.125 H4.5" />
      <path d="M6.5 5.175 L4.5 6.875 L6.5 8.575 M13.5 11.425 L15.5 13.125 L13.5 14.825" />
    </svg>
  );
}

/**
 * Set path start: a closed loop with its first anchor flagged by a play mark.
 *
 * @experimental
 */
export function SetPathStartIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="10" cy="11.5" r="5.5" strokeWidth={1.25} />
      {anchor(10, 6)}
      <path d="M13 2.6 L16 4.1 L13 5.6 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Corners: a rounded corner, with the sharp one it replaced dashed. Used for
 * Set corners and the corner radius drag.
 *
 * @experimental
 */
export function CornerRadiusIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M4.375 17 V11.375 A7 7 0 0 1 11.375 4.375 H17" />
      <path d="M4.375 8 V4.375 H8" strokeWidth={1} strokeDasharray="1.3 1.3" />
    </svg>
  );
}

/**
 * Next corner shape: a chamfered corner, with the round shape before it dashed.
 *
 * @experimental
 */
export function CornerShapeIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M4 17 V10.5 L10.5 4 H17" />
      <path d="M4 10.5 A6.5 6.5 0 0 0 10.5 4" strokeWidth={1} strokeDasharray="1.3 1.3" />
    </svg>
  );
}

const SEGMENT_LINE = 'M4 14 H16';
const SEGMENT_CURVE = 'M4 14 C4 6 16 6 16 14';
const DASHED = { strokeWidth: 1, strokeDasharray: '1.4 1.4' };

/**
 * Convert segments: one segment's two forms, straight and curved, between
 * the same anchors.
 *
 * @experimental
 */
export function ConvertSegmentIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d={SEGMENT_LINE} />
      <path d={SEGMENT_CURVE} />
      {anchor(4, 14)}
      {anchor(16, 14)}
    </svg>
  );
}

/**
 * Make segments straight: the straight form solid, the curve dashed.
 *
 * @experimental
 */
export function StraightenSegmentIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d={SEGMENT_LINE} />
      <path d={SEGMENT_CURVE} {...DASHED} />
      {anchor(4, 14)}
      {anchor(16, 14)}
    </svg>
  );
}

/**
 * Make segments curved: the curve solid, the straight form dashed.
 *
 * @experimental
 */
export function CurveSegmentIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d={SEGMENT_LINE} {...DASHED} />
      <path d={SEGMENT_CURVE} />
      {anchor(4, 14)}
      {anchor(16, 14)}
    </svg>
  );
}

/**
 * Add extreme anchors: an arch with a new anchor at its top, on the level
 * tangent there.
 *
 * @experimental
 */
export function ExtremeAnchorsIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 16 C3 4.5 17 4.5 17 16" />
      <path d="M6.5 7.4 H13.5" strokeWidth={1} />
      {anchor(3, 16)}
      {anchor(17, 16)}
      {anchor(10, 7.4)}
    </svg>
  );
}
