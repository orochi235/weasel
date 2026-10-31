// WeaselDraw's own controls.

export const ACTIONS = {
  releaseCompound: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="2" y="5" width="6" height="10" fill="currentColor" stroke="none"/>
      <rect x="12" y="5" width="6" height="10"/>
      <line x1="10" y1="3" x2="10" y2="17" stroke-dasharray="1.5 1.5"/>
    </g>`,
  // core:flipX's trapezoids with both halves outlined: an even pair, so the mode never reads as the flip action.
  symmetry: `
    <path d="M1.25 2.5 8.75 6.25 8.75 13.75 1.25 17.5Z M2.5 4.5225 7.5 7.0225 7.5 12.9775 2.5 15.4775Z" fill="currentColor" fill-rule="evenodd" stroke="none"/>
    <path d="M18.75 2.5 11.25 6.25 11.25 13.75 18.75 17.5Z M17.5 4.5225 12.5 7.0225 12.5 12.9775 17.5 15.4775Z" fill="currentColor" fill-rule="evenodd" stroke="none"/>`,
  settings: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M10 1.5 L11.2 3.6 L13.6 3 L13.7 5.4 L15.8 6.6 L14.5 8.6 L15.8 10.6 L13.7 11.8 L13.6 14.2 L11.2 13.6 L10 15.7 L8.8 13.6 L6.4 14.2 L6.3 11.8 L4.2 10.6 L5.5 8.6 L4.2 6.6 L6.3 5.4 L6.4 3 L8.8 3.6 Z" stroke-linejoin="round"/>
      <circle cx="10" cy="8.6" r="2.4"/>
    </g>`,
  width: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="1.5" height="14" fill="currentColor" stroke="none"/>
      <rect x="15.5" y="3" width="1.5" height="14" fill="currentColor" stroke="none"/>
      <line x1="6" y1="10" x2="14" y2="10"/>
      <path d="M6 10 L8 8 M6 10 L8 12" stroke-linecap="round"/>
      <path d="M14 10 L12 8 M14 10 L12 12" stroke-linecap="round"/>
    </g>`,
  height: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="14" height="1.5" fill="currentColor" stroke="none"/>
      <rect x="3" y="15.5" width="14" height="1.5" fill="currentColor" stroke="none"/>
      <line x1="10" y1="6" x2="10" y2="14"/>
      <path d="M10 6 L8 8 M10 6 L12 8" stroke-linecap="round"/>
      <path d="M10 14 L8 12 M10 14 L12 12" stroke-linecap="round"/>
    </g>`,
  fontSize: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="3" y="17" font-size="14" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">A</text>
      <text x="12" y="17" font-size="9" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">a</text>
    </g>`,
  bold: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="10" y="16" text-anchor="middle" font-size="16" font-weight="900" font-family="ui-serif, Georgia, serif" fill="currentColor" stroke="none">B</text>
    </g>`,
  italic: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="10" y="16" text-anchor="middle" font-size="16" font-style="italic" font-weight="500" font-family="ui-serif, Georgia, serif" fill="currentColor" stroke="none">I</text>
    </g>`,
  underline: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="10" y="14" text-anchor="middle" font-size="13" font-weight="500" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">U</text>
      <line x1="5" y1="17" x2="15" y2="17" stroke-width="1.5"/>
    </g>`,
  strikethrough: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="10" y="15" text-anchor="middle" font-size="13" font-weight="500" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">S</text>
      <line x1="3" y1="10" x2="17" y2="10" stroke-width="1.5"/>
    </g>`,
  opacity: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="3" y="3" width="14" height="14" rx="1"/>
      <path d="M4 4 L16 16 L4 16 Z" fill="currentColor" stroke="none"/>
    </g>`,
  strokeWidth: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="3" y1="5" x2="17" y2="5" stroke-width="1" stroke-linecap="round"/>
      <line x1="3" y1="10" x2="17" y2="10" stroke-width="2.25" stroke-linecap="round"/>
      <line x1="3" y1="15" x2="17" y2="15" stroke-width="3.5" stroke-linecap="round"/>
    </g>`,
  rotation: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M16 10 A 6 6 0 1 0 10 16" stroke-linecap="round"/>
      <path d="M10 16 L8 14 M10 16 L12 14" stroke-linecap="round"/>
    </g>`,
  cornerRadius: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M4 17 L4 9 A 5 5 0 0 1 9 4 L17 4" stroke-linecap="round"/>
      <path d="M11 17 L17 17 L17 11" stroke-linecap="round"/>
    </g>`,
  letterSpacing: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <text x="2" y="11" font-size="8" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">A</text>
      <text x="13" y="11" font-size="8" font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor" stroke="none">V</text>
      <line x1="8" y1="15" x2="13" y2="15"/>
      <path d="M8 15 L10 13 M8 15 L10 17" stroke-linecap="round"/>
      <path d="M13 15 L11 13 M13 15 L11 17" stroke-linecap="round"/>
    </g>`,
  lineHeight: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <rect x="6" y="4" width="11" height="1.5" fill="currentColor" stroke="none"/>
      <rect x="6" y="14.5" width="11" height="1.5" fill="currentColor" stroke="none"/>
      <line x1="3" y1="6" x2="3" y2="14"/>
      <path d="M3 6 L1.5 8 M3 6 L4.5 8" stroke-linecap="round"/>
      <path d="M3 14 L1.5 12 M3 14 L4.5 12" stroke-linecap="round"/>
    </g>`,
  position: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none"/>
      <line x1="4" y1="16" x2="16" y2="16" stroke-linecap="round"/>
      <path d="M16 16 L14 14.5 M16 16 L14 17.5" stroke-linecap="round"/>
      <line x1="4" y1="16" x2="4" y2="4" stroke-linecap="round"/>
      <path d="M4 4 L2.5 6 M4 4 L5.5 6" stroke-linecap="round"/>
    </g>`,
  fill: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M7 3 L13 3 L15 10 L5 10 Z" stroke-linejoin="round"/>
      <ellipse cx="10" cy="10" rx="5" ry="1.2" fill="currentColor" stroke="none"/>
      <ellipse cx="10" cy="10" rx="5" ry="1.2"/>
      <line x1="10" y1="11" x2="10" y2="18" stroke-width="2.5" stroke-linecap="round"/>
    </g>`,
  stroke: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <line x1="4" y1="16" x2="16" y2="4" stroke-width="3" stroke-linecap="round"/>
    </g>`,
  record: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="10" cy="10" r="5"/>
    </g>`,
  playRecording: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M7 5 L15 10 L7 15 Z" stroke-linejoin="round"/>
    </g>`,
};
