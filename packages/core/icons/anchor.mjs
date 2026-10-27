import { chevron, GRID_HEAD, px } from '../../icons/scripts/lib/base.mjs';
// Drawn from core's anchorIcons components.

// Nudge anchors: a hatched block pushed by a two-ring pulse behind it, pointing the way it moves. At 16px a unit is
// 0.8 px, so the block's edges sit on whole pixels and each hatch line, x + y a multiple of 1.25, crosses pixel
// centers. The hatch runs through the block's top-right and bottom-left corners, so no sliver is left at either.
// Right is the glyph for nudging as such, where no direction is given.
const nudge = (turn) => `
    <g transform="rotate(${turn} 10 10)">
      <path d="M4.1605 6.4645 A5 5 0 0 1 4.1605 13.5355"/>
      <path d="M6.8122 3.8128 A8.75 8.75 0 0 1 6.8122 16.1872"/>
      <svg x="11.25" y="3.75" width="5" height="12.5" viewBox="11.25 3.75 5 12.5" overflow="hidden">
        <path d="M0 16.25 L20 -3.75 M3.75 16.25 L23.75 -3.75 M7.5 16.25 L27.5 -3.75 M11.25 16.25 L31.25 -3.75 M15 16.25 L35 -3.75" stroke-width="1" stroke-linecap="butt"/>
      </svg>
    </g>`;

export const ANCHOR = {
  // A corner on the pixel diagonal, its anchor three pixels square, and arrows on pixel row 2 closing on it.
  retractHandles: `
    <path d="M${px(1)} ${px(12)} L${px(7)} ${px(6)} L${px(13)} ${px(12)}"/>
    <path d="M${px(0)} ${px(2)} H${px(4)} M${px(14)} ${px(2)} H${px(10)}" stroke-width="1.25"/>
    <path d="${chevron([px(4), px(2)], [1, 0], ...GRID_HEAD)}${chevron([px(10), px(2)], [-1, 0], ...GRID_HEAD)}" stroke-width="1.25"/>
    <rect x="${px(6) - 0.625}" y="${px(5) - 0.625}" width="3.75" height="3.75" fill="currentColor" stroke="none"/>`,
  // An arch of radius 6.25 about a pixel center, whose edges fall on pixel edges at a one-pixel stroke, its anchor
  // at the top, and the handle bar along its top reaching an equal six pixels either side.
  symmetricHandles: `
    <path d="M${px(2)} ${px(13)} V${px(9)} A6.25 6.25 0 0 1 ${px(12)} ${px(9)} V${px(13)}" stroke-width="1.25"/>
    <path d="M${px(1)} ${px(4)} H${px(13)}" stroke-width="1.25"/>
    <circle cx="${px(1)}" cy="${px(4)}" r="1.875" fill="currentColor" stroke="none"/>
    <circle cx="${px(13)}" cy="${px(4)}" r="1.875" fill="currentColor" stroke="none"/>
    <rect x="${px(6) - 0.625}" y="${px(3) - 0.625}" width="3.75" height="3.75" fill="currentColor" stroke="none"/>`,
  holdHandleAngle: `
    <path d="M5 15 L16 4"/>
    <path d="M12 4 H16 V8"/>
    <circle cx="10.5" cy="9.5" r="1.75" fill="currentColor" stroke="none"/>
    <rect x="3.5" y="13.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  holdHandleLength: `
    <circle cx="10" cy="10" r="6.5" stroke-width="1"/>
    <path d="M10 10 L14.5962 5.4038"/>
    <circle cx="14.5962" cy="5.4038" r="1.75" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  // A path that zigzags on the pixel diagonals until the brush's ring, and runs straight from inside it on. The
  // ring's edges, radius 3.75 about a pixel center at a one-pixel stroke, fall on pixel edges.
  simplifyBrush: `
    <path d="M${px(0)} ${px(10)} L${px(1)} ${px(9)} L${px(3)} ${px(11)} L${px(5)} ${px(9)} L${px(6)} ${px(10)} H${px(15)}" stroke-width="1.25"/>
    <circle cx="${px(10)}" cy="${px(10)}" r="3.75" stroke-width="1.25"/>`,
  // A circular arc, so its curvature is the same everywhere, its anchor at the top, under two equal teeth of a
  // curvature comb on its normals along the pixel diagonals.
  harmonize: `
    <path d="M${px(1)} ${px(13)} V${px(11)} A7.5 7.5 0 0 1 ${px(13)} ${px(11)} V${px(13)}" stroke-width="1.25"/>
    <path d="M${px(1.5)} ${px(5.5)} L${px(0)} ${px(4)} M${px(12.5)} ${px(5.5)} L${px(14)} ${px(4)}" stroke-width="1.25"/>
    <rect x="${px(6) - 0.625}" y="${px(4) - 0.625}" width="3.75" height="3.75" fill="currentColor" stroke="none"/>`,
  averageAnchors: `
    <path d="M5.6 5.6 L7.6 7.6 M14.4 5.6 L12.4 7.6 M10 14.4 V12.5" stroke-width="1.25"/>
    <rect x="2.875" y="2.875" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.125" y="2.875" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="14.125" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.125" y="8.125" width="3.75" height="3.75" stroke-width="1.25"/>`,
  bendSegment: `
    <path d="M3.5 15 H16.5" stroke-width="1" stroke-dasharray="1.4 1.4"/>
    <path d="M3.5 15 Q10 3 16.5 15"/>
    <path d="M10 12.5 V10 M8.8 11.2 L10 10 L11.2 11.2" stroke-width="1"/>
    <rect x="2" y="13.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="15" y="13.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  nudgeAnchors: nudge(0),
  nudgeAnchorsUp: nudge(-90),
  nudgeAnchorsDown: nudge(90),
  nudgeAnchorsLeft: nudge(180),
};
