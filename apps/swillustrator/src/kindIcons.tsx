/** Object-kind icons for the LayerList rows — one per Swillustrator kind
 *  (`rect`, `text`, `path`). 16×16 (slightly smaller than ActionBar icons
 *  so they sit comfortably in the 28px-tall list rows), same currentColor
 *  + 1.5px stroke convention as `actionIcons.tsx` and the kit's Pathfinder
 *  icons. Parent row supplies the accessible name via existing list-row
 *  semantics; the icons are `aria-hidden`.
 */
import type { ReactNode } from 'react';

const SVG_BASE = {
  viewBox: '0 0 16 16',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
};

export function RectIcon() {
  return (
    <svg {...SVG_BASE}>
      <rect x="3" y="4.5" width="10" height="7" />
    </svg>
  );
}

export function TextIcon() {
  // Serif "T" — top bar + stem + small bottom serif.
  return (
    <svg {...SVG_BASE}>
      <path d="M 3 4 L 13 4 M 8 4 L 8 12 M 6 12 L 10 12" strokeLinecap="round" />
    </svg>
  );
}

export function PathIcon() {
  // Smooth curve sketching out a path, with three anchor dots so it reads
  // as "freeform path with control points" rather than a primitive.
  return (
    <svg {...SVG_BASE}>
      <path d="M 2.5 12 Q 5.5 3.5 8 8 T 13.5 5" strokeLinecap="round" />
      <circle cx="2.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Dispatch by kind — convenient one-liner for consumers. */
export function KindIcon({ kind }: { kind: 'rect' | 'text' | 'path' }): ReactNode {
  switch (kind) {
    case 'rect': return <RectIcon />;
    case 'text': return <TextIcon />;
    case 'path': return <PathIcon />;
  }
}
