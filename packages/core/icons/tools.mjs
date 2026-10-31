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
  ellipse: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <ellipse cx="10" cy="10" rx="7" ry="5"/>
    </g>`,
  eyedropper: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="12.5" y1="3.5" x2="16.5" y2="7.5" stroke-linecap="round"/>
      <path d="M 11 7 L 13 5 a 2 2 0 0 1 2.8 0 l 1.2 1.2 a 2 2 0 0 1 0 2.8 L 15 11 Z" stroke-linejoin="round"/>
      <line x1="13" y1="9" x2="5" y2="17" stroke-linecap="round"/>
      <line x1="11" y1="7" x2="3" y2="15" stroke-linecap="round"/>
      <line x1="3" y1="15" x2="5" y2="17" stroke-linecap="round"/>
    </g>`,
  hand: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="5" y="10" width="10" height="7.5" rx="2"/>
      <line x1="6.5" y1="10" x2="6.5" y2="4.5" stroke-linecap="round"/>
      <line x1="9" y1="10" x2="9" y2="3" stroke-linecap="round"/>
      <line x1="11.5" y1="10" x2="11.5" y2="3.5" stroke-linecap="round"/>
      <line x1="14" y1="10" x2="14" y2="5.5" stroke-linecap="round"/>
      <line x1="5" y1="12.5" x2="2.5" y2="14.5" stroke-linecap="round"/>
    </g>`,
  image: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="4" width="14" height="12" rx="1"/>
      <circle cx="7" cy="8" r="1.4"/>
      <path d="M4 14l4-4 3 3 3-4 2 2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`,
  lasso: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 6 13 Q 2.5 8.5 5 5 Q 9 2 13.5 4.5 Q 17.5 7.5 15.5 11.5 Q 13 14 9.5 13.5 Q 7.5 13.2 6 13 Z" stroke-linejoin="round"/>
      <path d="M 6 13 L 4 17" stroke-linecap="round"/>
    </g>`,
  line: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="4" y1="16" x2="16" y2="4" stroke-linecap="round"/>
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
  polygon: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <polygon points="10,3 16.5,6.5 16.5,13.5 10,17 3.5,13.5 3.5,6.5" stroke-linejoin="round"/>
    </g>`,
  rect: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="5" y="6" width="11" height="9"/>
      <line x1="3" y1="4" x2="7" y2="4" stroke-linecap="round"/>
      <line x1="5" y1="2" x2="5" y2="6" stroke-linecap="round"/>
    </g>`,
  select: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 4 3 L 4 14.5 L 7.2 11.4 L 9.5 16 L 11.4 15.1 L 9.1 10.5 L 13.5 10.5 Z" fill="currentColor" stroke-linejoin="round"/>
    </g>`,
  slice: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 8.5 10.5 L 14.5 4.5 L 16.5 6.5 L 10.5 12.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M 8.5 10.5 L 3.5 15.5 L 10.5 12.5 Z" fill="currentColor" stroke-linejoin="round"/>
    </g>`,
  star: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <polygon points="10,2.5 12.1,7.9 17.8,8.3 13.4,12 14.8,17.5 10,14.4 5.2,17.5 6.6,12 2.2,8.3 7.9,7.9" stroke-linejoin="round"/>
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
  unknown: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="10" cy="10" r="7.5"/>
      <path d="M 7.5 8 Q 7.5 5.5 10 5.5 Q 12.5 5.5 12.5 8 Q 12.5 9.5 10 11 L 10 12.5" stroke-linecap="round"/>
      <circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none"/>
    </g>`,
};
