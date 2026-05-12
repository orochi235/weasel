/** Inline SVG icons for ActionBar — thematically compatible with the
 *  Pathfinder icons in @orochi235/weasel-ui (same 20×20 viewBox, stroked
 *  outlines in currentColor, filled regions in currentColor for the
 *  "highlighted" affordance — the alignment edge, the moving shape in a
 *  z-order op, etc.).
 *
 *  Each icon is `aria-hidden`; the parent button supplies the accessible
 *  name via `aria-label` + `title`.
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

// ──────────────────────────────────────────────────────────────────────────
// Align
// Pattern: thin filled bar marks the alignment axis; two outlined rects of
// different widths sit against (or centered on) that axis.
// ──────────────────────────────────────────────────────────────────────────

export function AlignLeftIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="1.5" height="16" fill="currentColor" stroke="none" />
      <rect x="4" y="4.5" width="12" height="4" />
      <rect x="4" y="11.5" width="7" height="4" />
    </svg>
  );
}

export function AlignCenterXIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="9.25" y="2" width="1.5" height="16" fill="currentColor" stroke="none" />
      <rect x="4" y="4.5" width="12" height="4" />
      <rect x="6.5" y="11.5" width="7" height="4" />
    </svg>
  );
}

export function AlignRightIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="16.5" y="2" width="1.5" height="16" fill="currentColor" stroke="none" />
      <rect x="4" y="4.5" width="12" height="4" />
      <rect x="9" y="11.5" width="7" height="4" />
    </svg>
  );
}

export function AlignTopIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="16" height="1.5" fill="currentColor" stroke="none" />
      <rect x="4.5" y="4" width="4" height="12" />
      <rect x="11.5" y="4" width="4" height="7" />
    </svg>
  );
}

export function AlignCenterYIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="9.25" width="16" height="1.5" fill="currentColor" stroke="none" />
      <rect x="4.5" y="4" width="4" height="12" />
      <rect x="11.5" y="6.5" width="4" height="7" />
    </svg>
  );
}

export function AlignBottomIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="16.5" width="16" height="1.5" fill="currentColor" stroke="none" />
      <rect x="4.5" y="4" width="4" height="12" />
      <rect x="11.5" y="9" width="4" height="7" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Distribute — three equal rects evenly spaced along the axis.
// ──────────────────────────────────────────────────────────────────────────

export function DistributeXIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2"  y="5" width="3" height="10" />
      <rect x="8.5" y="5" width="3" height="10" />
      <rect x="15" y="5" width="3" height="10" />
    </svg>
  );
}

export function DistributeYIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="5" y="2"   width="10" height="3" />
      <rect x="5" y="8.5" width="10" height="3" />
      <rect x="5" y="15"  width="10" height="3" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Flip — outlined chevron on one side, filled (mirrored) chevron on the
// other, dashed central axis. The shape asymmetry is what reads as "flip."
// ──────────────────────────────────────────────────────────────────────────

export function FlipXIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="10" y1="2" x2="10" y2="18" strokeDasharray="2 1.5" />
      <path d="M 8 4 L 3 10 L 8 16 Z" />
      <path d="M 12 4 L 17 10 L 12 16 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FlipYIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="2 1.5" />
      <path d="M 4 8 L 10 3 L 16 8 Z" />
      <path d="M 4 12 L 10 17 L 16 12 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Group / Ungroup — corner brackets around two filled child rects.
// Ungroup omits the brackets (children "escape" the frame).
// ──────────────────────────────────────────────────────────────────────────

export function GroupIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M 2 5 L 2 2 L 5 2" />
      <path d="M 18 5 L 18 2 L 15 2" />
      <path d="M 2 15 L 2 18 L 5 18" />
      <path d="M 18 15 L 18 18 L 15 18" />
      <rect x="5" y="6" width="4.5" height="8" fill="currentColor" stroke="none" />
      <rect x="11" y="6" width="4" height="8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UngroupIcon() {
  return (
    <svg {...SVG_BASE}>
      {/* Faded / dashed corner brackets — the frame is breaking apart. */}
      <path d="M 2 5 L 2 2 L 5 2" strokeDasharray="1.5 1.5" />
      <path d="M 18 15 L 18 18 L 15 18" strokeDasharray="1.5 1.5" />
      <rect x="3" y="5" width="4.5" height="8" fill="currentColor" stroke="none" />
      <rect x="13" y="7" width="4" height="8" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Z-order — stacked offset rects depict the post-op state. Back-of-stack
// is top-left, front-of-stack is bottom-right; the filled rect is the
// one that was just moved.
// ──────────────────────────────────────────────────────────────────────────

export function SendToBackIcon() {
  // After the op, the moving rect sits at back (top-left, filled).
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="9" height="9" fill="currentColor" stroke="none" />
      <rect x="6" y="6" width="9" height="9" />
      <rect x="9" y="9" width="9" height="9" />
    </svg>
  );
}

export function SendBackwardIcon() {
  // Single step back — two rects, filled (moved) one behind.
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="11" height="11" fill="currentColor" stroke="none" />
      <rect x="6" y="6" width="11" height="11" />
    </svg>
  );
}

export function BringForwardIcon() {
  // Single step forward — two rects, filled (moved) one in front.
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="11" height="11" />
      <rect x="6" y="6" width="11" height="11" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BringToFrontIcon() {
  // After the op, the moving rect sits at front (bottom-right, filled).
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="9" height="9" />
      <rect x="6" y="6" width="9" height="9" />
      <rect x="9" y="9" width="9" height="9" fill="currentColor" stroke="none" />
    </svg>
  );
}
