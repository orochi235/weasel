/** Icons for the path tools and the effects they make. */
import { anchor, DOT, SVG_BASE } from './iconBase';

/**
 * Smudge brush: a path dragged up into the brush ring that carries it.
 *
 * @experimental
 */
export function SmudgeBrushIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2 15.5 H5 C9 15.5 9.5 7 14 7" />
      <circle cx="14" cy="7" r="3.75" strokeWidth={1} />
      <path d="M14 7 C15.5 9.5 16.5 15.5 18 15.5" />
    </svg>
  );
}

/**
 * Distort: a box pulled out of square by its four corners.
 *
 * @experimental
 */
export function DistortIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3.5 4.5 L16 3 L17 16.5 L4.5 14.5 Z" />
      {anchor(3.5, 4.5)}
      {anchor(16, 3)}
      {anchor(17, 16.5)}
      {anchor(4.5, 14.5)}
    </svg>
  );
}

/**
 * Envelope: a box bowed top and bottom, with the mesh inside bent to match.
 *
 * @experimental
 */
export function EnvelopeIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3.5 5.5 Q10 0.5 16.5 5.5 V16.5 Q10 12.5 3.5 16.5 Z" />
      <path d="M10 3 V14.5 M3.5 11 Q10 7 16.5 11" strokeWidth={1} />
      <circle cx="3.5" cy="5.5" r="1.5" {...DOT} />
      <circle cx="16.5" cy="5.5" r="1.5" {...DOT} />
      <circle cx="16.5" cy="16.5" r="1.5" {...DOT} />
      <circle cx="3.5" cy="16.5" r="1.5" {...DOT} />
    </svg>
  );
}

/**
 * Puppet Warp: a bar bent between the two pins holding it.
 *
 * @experimental
 */
export function PuppetWarpIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2.5 11 C7 11 8 3 15 3 L17.5 7.5 C11 7.5 10 16 3.5 16 Z" />
      <circle cx="5" cy="13.5" r="1.5" {...DOT} />
      <circle cx="15.6" cy="5.3" r="1.5" {...DOT} />
    </svg>
  );
}

/**
 * Blend: a circle turning into a box, with the step between them lighter.
 *
 * @experimental
 */
export function BlendIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="4.5" cy="10" r="2.6" />
      <rect x="7.9" y="7" width="4.4" height="6" rx="1.6" strokeWidth={1} />
      <rect x="13.4" y="5.5" width="4.4" height="9" rx="0.5" />
    </svg>
  );
}

/**
 * Bend Along Path: a striped band bent over an arch.
 *
 * @experimental
 */
export function BendAlongIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M3 14 Q10 0 17 14 L14.5 15 Q10 5 5.5 15 Z" />
      <path d="M10 7 V9.9 M6.2 9.6 L8.1 11.4 M13.8 9.6 L11.9 11.4" strokeWidth={1} />
    </svg>
  );
}

/**
 * Repeat Along Path: copies of a ring spaced along an arch.
 *
 * @experimental
 */
export function RepeatAlongIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2.9 14.2 L3.6 12.9 M6.4 10.1 L8.2 8.8 M11.8 8.8 L13.6 10.1 M16.4 12.9 L17.1 14.2" strokeWidth={1} />
      <circle cx="4.75" cy="11.43" r="1.9" strokeWidth={1.25} />
      <circle cx="10" cy="8" r="1.9" strokeWidth={1.25} />
      <circle cx="15.25" cy="11.43" r="1.9" strokeWidth={1.25} />
    </svg>
  );
}

/**
 * Expand: a live outline, dashed, with the anchors it becomes. Used for
 * Expand to Paths and Expand Warp.
 *
 * @experimental
 */
export function ExpandIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="10" cy="10" r="6" strokeWidth={1.25} strokeDasharray="2 1.7" />
      {anchor(10, 4)}
      {anchor(16, 10)}
      {anchor(10, 16)}
      {anchor(4, 10)}
    </svg>
  );
}

/** A segment's two handles, the balance line between their knobs, and its
 *  grip: what path edit shows for balancing. */
function BalancedSegment() {
  return (
    <>
      <path d="M3.5 16 C5 6 15 6 16.5 16" />
      <path d="M3.5 16 L5 6 M16.5 16 L15 6 M5 6 H8.25 M11.75 6 H15" strokeWidth={1} />
      <circle cx="5" cy="6" r="1.4" {...DOT} />
      <circle cx="15" cy="6" r="1.4" {...DOT} />
      <circle cx="10" cy="6" r="1.75" strokeWidth={1.25} />
    </>
  );
}

/**
 * Balance handles: a segment's balance grip, with an arrow for the drag that
 * scales both handles together.
 *
 * @experimental
 */
export function BalanceHandlesIcon() {
  return (
    <svg {...SVG_BASE}>
      <BalancedSegment />
      <path d="M8.8 12 L10 13.2 L11.2 12 M10 9.6 V13" strokeWidth={1} />
    </svg>
  );
}

/**
 * Equalize handles: a segment's balance grip, with an equals sign for handles
 * evened out.
 *
 * @experimental
 */
export function EqualizeHandlesIcon() {
  return (
    <svg {...SVG_BASE}>
      <BalancedSegment />
      <path d="M8.5 10.8 H11.5 M8.5 12.8 H11.5" strokeWidth={1} />
    </svg>
  );
}

/**
 * Lengthen: an open path's end anchor, and the run it grows along dashed
 * on past it.
 *
 * @experimental
 */
export function LengthenIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2.5 17 C6.5 17 8.5 15.5 11 13" />
      <path d="M13 11 L16.5 7.5" strokeDasharray="1 3" />
      {anchor(11, 13)}
    </svg>
  );
}

/**
 * Trim segment: a stroke between two crossings, its middle piece gone.
 *
 * @experimental
 */
export function TrimIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M6.875 3 V17 M13.125 3 V17" strokeWidth={1.25} />
      <path d="M2.5 10.625 H6.875 M13.125 10.625 H17.5" />
      <path d="M8.6 10.625 H11.4" strokeWidth={1} strokeDasharray="1.2 1.2" />
    </svg>
  );
}

/**
 * Extend to next path: an open end carried on, dashed, to the stroke it meets.
 *
 * @experimental
 */
export function ExtendIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M16.875 3 V17" strokeWidth={1.25} />
      <path d="M2.5 10.625 H8" />
      {anchor(8, 10.625)}
      <path d="M10.5 10.625 H15" strokeWidth={1} strokeDasharray="1.4 1.3" />
    </svg>
  );
}

/**
 * Girth: a stroke swelling from fine ends, with the width handle across its
 * widest point.
 *
 * @experimental
 */
export function GirthIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M2.5 10 C6 4.6 14 4.6 17.5 10 C14 15.4 6 15.4 2.5 10 Z" />
      <path d="M10 6.6 V13.4" strokeWidth={1} />
      <circle cx="10" cy="6.6" r="1.4" {...DOT} />
      <circle cx="10" cy="13.4" r="1.4" {...DOT} />
    </svg>
  );
}
