// The tools editing offers: select, lasso, the shapes, and the eyedropper.
export const TOOLS = {
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
  lasso: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 6 13 Q 2.5 8.5 5 5 Q 9 2 13.5 4.5 Q 17.5 7.5 15.5 11.5 Q 13 14 9.5 13.5 Q 7.5 13.2 6 13 Z" stroke-linejoin="round"/>
      <path d="M 6 13 L 4 17" stroke-linecap="round"/>
    </g>`,
  line: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="4" y1="16" x2="16" y2="4" stroke-linecap="round"/>
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
  star: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <polygon points="10,2.5 12.1,7.9 17.8,8.3 13.4,12 14.8,17.5 10,14.4 5.2,17.5 6.6,12 2.2,8.3 7.9,7.9" stroke-linejoin="round"/>
    </g>`,
};
