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
  symmetricHandles: `
    <path d="M3 17 C3 10 6 8 10 8 S17 10 17 17"/>
    <path d="M3.5 8 H16.5" stroke-width="1"/>
    <circle cx="3.5" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="6.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
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
  simplifyBrush: `
    <path d="M2 16 C5 6 15 6 18 16"/>
    <circle cx="10" cy="8.5" r="5" stroke-width="1" stroke-dasharray="2 1.5"/>`,
  harmonize: `
    <path d="M3 16 C3 9 6.5 6 10 6 S17 9 17 16"/>
    <path d="M4.02 7.43 L2.47 6.18 M10 3.5 V1.5 M15.98 7.43 L17.53 6.18" stroke-width="1"/>
    <rect x="8.5" y="4.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
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
