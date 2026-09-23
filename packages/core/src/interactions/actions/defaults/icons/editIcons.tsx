/**
 * @experimental
 * Default icons for the clipboard, duplicate, group, reorder and flip actions.
 * Lifted verbatim from `apps/draw`'s action bar, in the register of the
 * Pathfinder icons beside them: 20x20 viewBox, stroked outlines in
 * `currentColor`, and a filled region for the shape the op moves or produces.
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

/** Cut: scissors. */
export function CutIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="6" cy="14" r="2.5" />
      <circle cx="14" cy="14" r="2.5" />
      <path d="M8 12 L16 4" strokeLinecap="round" />
      <path d="M12 12 L4 4" strokeLinecap="round" />
    </svg>
  );
}

/** Copy: a document peeking out behind another. */
export function CopyIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M6 14 H3 V3 H14 V6" strokeLinejoin="round" />
      <rect x="6" y="6" width="11" height="11" />
    </svg>
  );
}

/** Paste: a clipboard with a filled clip. */
export function PasteIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="4" y="5" width="12" height="13" rx="1" />
      <rect x="7.5" y="2.5" width="5" height="4" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Duplicate: the source outlined, the copy filled. */
export function DuplicateIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="10" height="10" />
      <rect x="7" y="7" width="10" height="10" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Group: corner brackets framing two filled rects. */
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

/** Ungroup: two filled rects escaping a frame broken to two dashed corners. */
export function UngroupIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M 2 5 L 2 2 L 5 2" strokeDasharray="1.5 1.5" />
      <path d="M 18 15 L 18 18 L 15 18" strokeDasharray="1.5 1.5" />
      <rect x="3" y="5" width="4.5" height="8" fill="currentColor" stroke="none" />
      <rect x="13" y="7" width="4" height="8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bring forward: two stacked rects, the front one filled. */
export function BringForwardIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="11" height="11" />
      <rect x="6" y="6" width="11" height="11" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bring to front: three stacked rects, the frontmost filled. */
export function BringToFrontIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="9" height="9" />
      <rect x="6" y="6" width="9" height="9" />
      <rect x="9" y="9" width="9" height="9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Send backward: two stacked rects, the rear one filled. */
export function SendBackwardIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="11" height="11" fill="currentColor" stroke="none" />
      <rect x="6" y="6" width="11" height="11" />
    </svg>
  );
}

/** Send to back: three stacked rects, the rearmost filled. */
export function SendToBackIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="2" width="9" height="9" fill="currentColor" stroke="none" />
      <rect x="6" y="6" width="9" height="9" />
      <rect x="9" y="9" width="9" height="9" />
    </svg>
  );
}

/** Flip horizontal: an outlined and a filled chevron either side of a dashed vertical axis. */
export function FlipXIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="10" y1="2" x2="10" y2="18" strokeDasharray="2 1.5" />
      <path d="M 8 4 L 3 10 L 8 16 Z" />
      <path d="M 12 4 L 17 10 L 12 16 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Flip vertical: an outlined and a filled chevron either side of a dashed horizontal axis. */
export function FlipYIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="2" y1="10" x2="18" y2="10" strokeDasharray="2 1.5" />
      <path d="M 4 8 L 10 3 L 16 8 Z" />
      <path d="M 4 12 L 10 17 L 16 12 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
