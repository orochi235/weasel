// Drawn from core's editIcons components.
export const EDIT = {
  cut: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="6" cy="14" r="2.5"/>
      <circle cx="14" cy="14" r="2.5"/>
      <path d="M8 12 L16 4" stroke-linecap="round"/>
      <path d="M12 12 L4 4" stroke-linecap="round"/>
    </g>`,
  copy: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M6 14 H3 V3 H14 V6" stroke-linejoin="round"/>
      <rect x="6" y="6" width="11" height="11"/>
    </g>`,
  paste: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="4" y="5" width="12" height="13" rx="1"/>
      <rect x="7.5" y="2.5" width="5" height="4" rx="0.5" fill="currentColor" stroke="none"/>
    </g>`,
  duplicate: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="10" height="10"/>
      <rect x="7" y="7" width="10" height="10" fill="currentColor" stroke="none"/>
    </g>`,
  transformAgain: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="2" y="2" width="8" height="8"/>
      <rect x="6" y="6" width="8" height="8"/>
      <rect x="10" y="10" width="8" height="8" fill="currentColor" stroke="none"/>
    </g>`,
  group: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 2 5 L 2 2 L 5 2"/>
      <path d="M 18 5 L 18 2 L 15 2"/>
      <path d="M 2 15 L 2 18 L 5 18"/>
      <path d="M 18 15 L 18 18 L 15 18"/>
      <rect x="5" y="6" width="4.5" height="8" fill="currentColor" stroke="none"/>
      <rect x="11" y="6" width="4" height="8" fill="currentColor" stroke="none"/>
    </g>`,
  ungroup: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 2 5 L 2 2 L 5 2" stroke-dasharray="1.5 1.5"/>
      <path d="M 18 15 L 18 18 L 15 18" stroke-dasharray="1.5 1.5"/>
      <rect x="3" y="5" width="4.5" height="8" fill="currentColor" stroke="none"/>
      <rect x="13" y="7" width="4" height="8" fill="currentColor" stroke="none"/>
    </g>`,
  bringForward: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="11" height="11"/>
      <rect x="6" y="6" width="11" height="11" fill="currentColor" stroke="none"/>
    </g>`,
  bringToFront: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="2" y="2" width="9" height="9"/>
      <rect x="6" y="6" width="9" height="9"/>
      <rect x="9" y="9" width="9" height="9" fill="currentColor" stroke="none"/>
    </g>`,
  sendBackward: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="11" height="11" fill="currentColor" stroke="none"/>
      <rect x="6" y="6" width="11" height="11"/>
    </g>`,
  sendToBack: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="2" y="2" width="9" height="9" fill="currentColor" stroke="none"/>
      <rect x="6" y="6" width="9" height="9"/>
      <rect x="9" y="9" width="9" height="9"/>
    </g>`,
  flipX: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="10" y1="2" x2="10" y2="18" stroke-dasharray="2 1.5"/>
      <path d="M 8 4 L 3 10 L 8 16 Z"/>
      <path d="M 12 4 L 17 10 L 12 16 Z" fill="currentColor" stroke="none"/>
    </g>`,
  flipY: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="2" y1="10" x2="18" y2="10" stroke-dasharray="2 1.5"/>
      <path d="M 4 8 L 10 3 L 16 8 Z"/>
      <path d="M 4 12 L 10 17 L 16 12 Z" fill="currentColor" stroke="none"/>
    </g>`,
};
