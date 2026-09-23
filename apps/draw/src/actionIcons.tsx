/** Inline SVG icons for WeaselDraw's own controls — the same register as the
 *  kit's action glyphs (20×20 viewBox, stroked outlines in currentColor,
 *  filled regions in currentColor for the "highlighted" affordance).
 *
 *  Each icon is `aria-hidden`; the parent button supplies the accessible
 *  name.
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

export function ReleaseCompoundIcon() {
  // Two formerly-conjoined regions pulling apart — left filled, right
  // outlined, with a dashed break between them.
  return (
    <svg {...SVG_BASE}>
      <rect x="2" y="5" width="6" height="10" fill="currentColor" stroke="none" />
      <rect x="12" y="5" width="6" height="10" />
      <line x1="10" y1="3" x2="10" y2="17" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Settings — classic gear/cog: outer toothed ring + inner hub circle.
// Stroked teeth (8 of them) match the outlined style of the other icons.
// ──────────────────────────────────────────────────────────────────────────

export function SettingsIcon() {
  return (
    <svg {...SVG_BASE}>
      <path
        d="M10 1.5 L11.2 3.6 L13.6 3 L13.7 5.4 L15.8 6.6 L14.5 8.6 L15.8 10.6 L13.7 11.8 L13.6 14.2 L11.2 13.6 L10 15.7 L8.8 13.6 L6.4 14.2 L6.3 11.8 L4.2 10.6 L5.5 8.6 L4.2 6.6 L6.3 5.4 L6.4 3 L8.8 3.6 Z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8.6" r="2.4" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Record — input-tooling control. Swaps to a filled red disc when active.
// ──────────────────────────────────────────────────────────────────────────

export function RecordIcon({ active = false }: { active?: boolean }) {
  // Active state uses an explicit red fill so it reads as "armed/recording"
  // regardless of the button's currentColor.
  return (
    <svg {...SVG_BASE}>
      <circle
        cx="10"
        cy="10"
        r="5"
        fill={active ? '#d23a2a' : 'none'}
        stroke={active ? '#d23a2a' : 'currentColor'}
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Property icons — pose, paint, and typography fields.
// Style: same 20×20, currentColor strokes, filled regions for the
// "highlighted" affordance (the bar being measured, the letter being
// styled, etc.). Letter-form icons (Bold/Italic/Underline) use SVG <text>
// since drawing letterform paths from scratch would be a lot of glyph
// authoring for no benefit — text inherits font from the surrounding UI.
// ──────────────────────────────────────────────────────────────────────────

/** Horizontal extent — two end-posts with a double-headed arrow between. */
export function WidthIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="1.5" height="14" fill="currentColor" stroke="none" />
      <rect x="15.5" y="3" width="1.5" height="14" fill="currentColor" stroke="none" />
      <line x1="6" y1="10" x2="14" y2="10" />
      <path d="M6 10 L8 8 M6 10 L8 12" strokeLinecap="round" />
      <path d="M14 10 L12 8 M14 10 L12 12" strokeLinecap="round" />
    </svg>
  );
}

/** Vertical extent — width rotated 90°. */
export function HeightIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="14" height="1.5" fill="currentColor" stroke="none" />
      <rect x="3" y="15.5" width="14" height="1.5" fill="currentColor" stroke="none" />
      <line x1="10" y1="6" x2="10" y2="14" />
      <path d="M10 6 L8 8 M10 6 L12 8" strokeLinecap="round" />
      <path d="M10 14 L8 12 M10 14 L12 12" strokeLinecap="round" />
    </svg>
  );
}

/** Big A + little a — scale affordance. */
export function FontSizeIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="3" y="17"
        fontSize="14" fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >A</text>
      <text
        x="12" y="17"
        fontSize="9" fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >a</text>
    </svg>
  );
}

/** Bold "B". */
export function BoldIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="10" y="16" textAnchor="middle"
        fontSize="16" fontWeight="900"
        fontFamily="ui-serif, Georgia, serif"
        fill="currentColor" stroke="none"
      >B</text>
    </svg>
  );
}

/** Italic "I". */
export function ItalicIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="10" y="16" textAnchor="middle"
        fontSize="16" fontStyle="italic" fontWeight="500"
        fontFamily="ui-serif, Georgia, serif"
        fill="currentColor" stroke="none"
      >I</text>
    </svg>
  );
}

/** Underlined "U". */
export function UnderlineIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="10" y="14" textAnchor="middle"
        fontSize="13" fontWeight="500"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >U</text>
      <line x1="5" y1="17" x2="15" y2="17" strokeWidth="1.5" />
    </svg>
  );
}

/** Strikethrough "S". */
export function StrikethroughIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="10" y="15" textAnchor="middle"
        fontSize="13" fontWeight="500"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >S</text>
      <line x1="3" y1="10" x2="17" y2="10" strokeWidth="1.5" />
    </svg>
  );
}

/** Square half-filled diagonally — partial coverage = opacity. */
export function OpacityIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <path d="M4 4 L16 16 L4 16 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Three horizontal lines, thin → thick. */
export function StrokeWidthIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="3" y1="5" x2="17" y2="5" strokeWidth="1" strokeLinecap="round" />
      <line x1="3" y1="10" x2="17" y2="10" strokeWidth="2.25" strokeLinecap="round" />
      <line x1="3" y1="15" x2="17" y2="15" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Rounded refresh-style arrow tracing 3/4 of a circle. */
export function RotationIcon() {
  return (
    <svg {...SVG_BASE}>
      <path
        d="M16 10 A 6 6 0 1 0 10 16"
        strokeLinecap="round"
      />
      <path d="M10 16 L8 14 M10 16 L12 14" strokeLinecap="round" />
    </svg>
  );
}

/** Rounded-corner square with a sharp diagonally-opposite corner. */
export function CornerRadiusIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M4 17 L4 9 A 5 5 0 0 1 9 4 L17 4" strokeLinecap="round" />
      <path d="M11 17 L17 17 L17 11" strokeLinecap="round" />
    </svg>
  );
}

/** "AV" with a horizontal double-headed arrow between — tracking. */
export function LetterSpacingIcon() {
  return (
    <svg {...SVG_BASE}>
      <text
        x="2" y="11"
        fontSize="8" fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >A</text>
      <text
        x="13" y="11"
        fontSize="8" fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor" stroke="none"
      >V</text>
      <line x1="8" y1="15" x2="13" y2="15" />
      <path d="M8 15 L10 13 M8 15 L10 17" strokeLinecap="round" />
      <path d="M13 15 L11 13 M13 15 L11 17" strokeLinecap="round" />
    </svg>
  );
}

/** Two horizontal bars stacked with a vertical double-headed arrow — leading. */
export function LineHeightIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="6" y="4" width="11" height="1.5" fill="currentColor" stroke="none" />
      <rect x="6" y="14.5" width="11" height="1.5" fill="currentColor" stroke="none" />
      <line x1="3" y1="6" x2="3" y2="14" />
      <path d="M3 6 L1.5 8 M3 6 L4.5 8" strokeLinecap="round" />
      <path d="M3 14 L1.5 12 M3 14 L4.5 12" strokeLinecap="round" />
    </svg>
  );
}

/** Position (x, y) — small filled dot at origin with two axis arrows. */
export function PositionIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <line x1="4" y1="16" x2="16" y2="16" strokeLinecap="round" />
      <path d="M16 16 L14 14.5 M16 16 L14 17.5" strokeLinecap="round" />
      <line x1="4" y1="16" x2="4" y2="4" strokeLinecap="round" />
      <path d="M4 4 L2.5 6 M4 4 L5.5 6" strokeLinecap="round" />
    </svg>
  );
}

/** Paint bucket tipped upside-down, pouring a vertical stream — fill
 *  swatch. Body is an inverted trapezoid (wider at the bottom where the
 *  rim sits); the filled ellipse marks the opening; the stream is a
 *  thick line falling straight down. */
export function FillIcon() {
  return (
    <svg {...SVG_BASE}>
      <path d="M7 3 L13 3 L15 10 L5 10 Z" strokeLinejoin="round" />
      <ellipse cx="10" cy="10" rx="5" ry="1.2" fill="currentColor" stroke="none" />
      <ellipse cx="10" cy="10" rx="5" ry="1.2" />
      <line x1="10" y1="11" x2="10" y2="18" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Thick diagonal line — stroke swatch. Rounded caps so it reads as a
 *  drawn mark rather than a geometric primitive. */
export function StrokeIcon() {
  return (
    <svg {...SVG_BASE}>
      <line x1="4" y1="16" x2="16" y2="4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

