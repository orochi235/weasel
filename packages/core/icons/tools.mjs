// The tool palette's glyphs, drawn from core's tool icon components.
export const TOOLS = {
  // The select arrow hollow, for path edit's anchor editing. Its upright edge and the foot of its head sit on pixel
  // centers at a one-pixel stroke, so both are crisp at 16px.
  anchors: `
    <path d="M 4.375 3.125 L 4.375 14.6 L 7.55 11.5 L 9.85 16.1 L 11.75 15.2 L 9.45 10.625 L 13.75 10.625 Z" stroke-width="1.25" stroke-linejoin="round"/>`,
  arrow: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M3.5 16.5 12.9 7.1" stroke-linecap="round"/>
      <path d="M16.5 3.5 11.06 5.98 14.03 8.95Z" fill="currentColor" stroke-linejoin="round"/>
    </g>`,
  // An open hand, after AppKit's current openHand cursor (not the older art in HIServices' cursors folder).
  hand: `
    <path d="M 9.884 18.977 C 10.163 18.66 7.876 18.698 6.742 16.894 C 5.89 15.54 5.98 15.072 5.013 13.398 L 2.544 10.209 C 2.056 9.721 2.287 8.625 2.776 8.136 C 3.264 7.648 4.055 7.648 4.544 8.136 L 7.178 10.86 L 5.842 4.576 C 5.712 3.898 6.157 3.243 6.835 3.114 C 7.494 2.988 8.134 3.404 8.287 4.057 L 9.363 9.039 L 8.939 2.748 C 8.909 2.058 9.443 1.475 10.133 1.445 C 10.797 1.415 11.368 1.911 11.432 2.573 L 11.875 8.858 L 12.241 3.67 C 12.289 2.981 12.887 2.462 13.575 2.511 C 14.264 2.559 14.783 3.156 14.735 3.845 L 14.387 9.539 L 15.567 4.567 C 15.721 3.894 16.392 3.474 17.065 3.628 C 17.723 3.779 18.142 4.425 18.012 5.087 L 16.848 10.565 C 16.557 11.934 16.898 13.565 16.75 15.365 C 16.55 17.165 16.007 17.653 15.407 18.753" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>`,
  image: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="4" width="14" height="12" rx="1"/>
      <circle cx="7" cy="8" r="1.4"/>
      <path d="M4 14l4-4 3 3 3-4 2 2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  pen: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 4 4 L 8.5 4 L 16 11.5 L 13 14.5 L 4 5.5 Z" fill="currentColor" stroke-linejoin="round"/>
      <line x1="13" y1="14.5" x2="14.2" y2="15.7" stroke-linecap="round"/>
      <circle cx="15.5" cy="16.5" r="1.1" fill="currentColor" stroke="none"/>
    </g>`,
  pencil: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 3 17 L 5.5 14.5 L 14 6 L 17 9 L 8.5 17.5 L 6 17 Z" stroke-linejoin="round"/>
      <line x1="12" y1="4" x2="17" y2="9" stroke-linecap="round"/>
    </g>`,
  slice: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 8.5 10.5 L 14.5 4.5 L 16.5 6.5 L 10.5 12.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M 8.5 10.5 L 3.5 15.5 L 10.5 12.5 Z" fill="currentColor" stroke-linejoin="round"/>
    </g>`,
  sticky: `
    <g stroke-linecap="butt" stroke-linejoin="round">
      <path d="M 3.5 3.5 L 16.5 3.5 L 16.5 12 L 12 16.5 L 3.5 16.5 Z"/>
      <path d="M 16.5 12 L 12 12 L 12 16.5"/>
      <path d="M 6.5 7.5 L 13.5 7.5 M 6.5 10.5 L 9.5 10.5" stroke-linecap="round"/>
    </g>`,
  text: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 4 5 L 16 5 M 10 5 L 10 16 M 7 16 L 13 16" stroke-linecap="round"/>
    </g>`,
};
