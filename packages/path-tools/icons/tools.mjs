// Path tools and the effects they make.
export const TOOLS = {
  smudgeBrush: `
    <path d="M2 15.5 H5 C9 15.5 9.5 7 14 7"/>
    <circle cx="14" cy="7" r="3.75" stroke-width="1"/>
    <path d="M14 7 C15.5 9.5 16.5 15.5 18 15.5"/>`,
  distort: `
    <path d="M3.5 4.5 L16 3 L17 16.5 L4.5 14.5 Z"/>
    <rect x="2" y="3" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="1.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="15.5" y="15" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="3" y="13" width="3" height="3" fill="currentColor" stroke="none"/>`,
  envelope: `
    <path d="M3.5 5.5 Q10 0.5 16.5 5.5 V16.5 Q10 12.5 3.5 16.5 Z"/>
    <path d="M10 3 V14.5 M3.5 11 Q10 7 16.5 11" stroke-width="1"/>
    <circle cx="3.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="5.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="16.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="3.5" cy="16.5" r="1.5" fill="currentColor" stroke="none"/>`,
  puppetWarp: `
    <path d="M2.5 11 C7 11 8 3 15 3 L17.5 7.5 C11 7.5 10 16 3.5 16 Z"/>
    <circle cx="5" cy="13.5" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="15.6" cy="5.3" r="1.5" fill="currentColor" stroke="none"/>`,
  blend: `
    <circle cx="4.5" cy="10" r="2.6"/>
    <rect x="7.9" y="7" width="4.4" height="6" rx="1.6" stroke-width="1"/>
    <rect x="13.4" y="5.5" width="4.4" height="9" rx="0.5"/>`,
  // Each stripe runs along the band's normal from one edge's line to the other's and stops there: a cap past
  // either line shows outside the band.
  bendAlong: `
    <path d="M3 14 Q10 0 17 14 L14.5 15 Q10 5 5.5 15 Z"/>
    <path d="M10 7 V10 M6.5 8.75 L8.39 10.64 M13.5 8.75 L11.61 10.64" stroke-width="1" stroke-linecap="butt"/>`,
  repeatAlong: `
    <path d="M2.9 14.2 L3.6 12.9 M6.4 10.1 L8.2 8.8 M11.8 8.8 L13.6 10.1 M16.4 12.9 L17.1 14.2" stroke-width="1"/>
    <circle cx="4.75" cy="11.43" r="1.9" stroke-width="1.25"/>
    <circle cx="10" cy="8" r="1.9" stroke-width="1.25"/>
    <circle cx="15.25" cy="11.43" r="1.9" stroke-width="1.25"/>`,
  // Set 0.625 left of center so the stem and bar fill whole pixels at 16px.
  textAlong: `
    <path d="M1.875 16 Q9.375 7.75 16.875 16"/>
    <path d="M5.375 3.125 H13.375 M9.375 3.125 V8.25"/>`,
  expand: `
    <circle cx="10" cy="10" r="6" stroke-width="1.25" stroke-dasharray="2 1.7"/>
    <rect x="8.5" y="2.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="14.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="8.5" y="14.5" width="3" height="3" fill="currentColor" stroke="none"/>
    <rect x="2.5" y="8.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  balanceHandles: `
    <path d="M3.5 16 C5 6 15 6 16.5 16"/>
    <path d="M3.5 16 L5 6 M16.5 16 L15 6 M5 6 H8.25 M11.75 6 H15" stroke-width="1"/>
    <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="6" r="1.75" stroke-width="1.25"/>
    <path d="M8.8 12 L10 13.2 L11.2 12 M10 9.6 V13" stroke-width="1"/>`,
  equalizeHandles: `
    <path d="M3.5 16 C5 6 15 6 16.5 16"/>
    <path d="M3.5 16 L5 6 M16.5 16 L15 6 M5 6 H8.25 M11.75 6 H15" stroke-width="1"/>
    <circle cx="5" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="6" r="1.75" stroke-width="1.25"/>
    <path d="M8.5 10.8 H11.5 M8.5 12.8 H11.5" stroke-width="1"/>`,
  lengthen: `
    <path d="M2.5 17 C6.5 17 8.5 15.5 11 13"/>
    <path d="M13 11 L16.5 7.5" stroke-dasharray="1 3"/>
    <rect x="9.5" y="11.5" width="3" height="3" fill="currentColor" stroke="none"/>`,
  trim: `
    <path d="M6.875 3 V17 M13.125 3 V17" stroke-width="1.25"/>
    <path d="M2.5 10.625 H6.875 M13.125 10.625 H17.5"/>
    <path d="M8.6 10.625 H11.4" stroke-width="1" stroke-dasharray="1.2 1.2"/>`,
  extend: `
    <path d="M16.875 3 V17" stroke-width="1.25"/>
    <path d="M2.5 10.625 H8"/>
    <rect x="6.5" y="9.125" width="3" height="3" fill="currentColor" stroke="none"/>
    <path d="M10.5 10.625 H15" stroke-width="1" stroke-dasharray="1.4 1.3"/>`,
  girth: `
    <path d="M2.5 10 C6 4.6 14 4.6 17.5 10 C14 15.4 6 15.4 2.5 10 Z"/>
    <path d="M10 6.6 V13.4" stroke-width="1"/>
    <circle cx="10" cy="6.6" r="1.4" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="13.4" r="1.4" fill="currentColor" stroke="none"/>`,
  spiro: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 3.5 15 C 6.5 15 7 10 10 10 C 13 10 13.5 5 16.5 5" stroke-linecap="round"/>
      <circle cx="3.5" cy="15" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="16.5" cy="5" r="1.6" fill="currentColor" stroke="none"/>
    </g>`,
};
