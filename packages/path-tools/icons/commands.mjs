// Path-structure commands: direction, start, corners, segment type and extremes.
export const COMMANDS = {
  reversePath: `
    <path d="M4.5 6.875 H15.5 M15.5 13.125 H4.5"/>
    <path d="M6.5 5.175 L4.5 6.875 L6.5 8.575 M13.5 11.425 L15.5 13.125 L13.5 14.825"/>`,
  setPathStart: `
    <circle cx="10" cy="11.5" r="5.5" stroke-width="1.25"/>
    <rect x="8.5" y="4.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <path d="M13 2.6 L16 4.1 L13 5.6 Z" fill="currentColor" stroke="none"/>`,
  cornerRadius: `
    <path d="M4.375 17 V11.375 A7 7 0 0 1 11.375 4.375 H17"/>
    <path d="M4.375 8 V4.375 H8" stroke-width="1" stroke-dasharray="1.3 1.3"/>`,
  cornerShape: `
    <path d="M4 17 V10.5 L10.5 4 H17"/>
    <path d="M4 10.5 A6.5 6.5 0 0 0 10.5 4" stroke-width="1" stroke-dasharray="1.3 1.3"/>`,
  convertSegment: `
    <path d="M4 14 H16"/>
    <path d="M4 14 C4 6 16 6 16 14"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  straightenSegment: `
    <path d="M4 14 H16"/>
    <path d="M4 14 C4 6 16 6 16 14" stroke-width="1" stroke-dasharray="1.4 1.4"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  curveSegment: `
    <path d="M4 14 H16" stroke-width="1" stroke-dasharray="1.4 1.4"/>
    <path d="M4 14 C4 6 16 6 16 14"/>
    <rect x="2.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="12.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  extremeAnchors: `
    <path d="M3 16 C3 4.5 17 4.5 17 16"/>
    <path d="M6.5 7.4 H13.5" stroke-width="1"/>
    <rect x="1.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="15.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="5.9" width="3" height="3" fill="currentColor" stroke="none"/>`,
};
