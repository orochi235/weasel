// Drawn from core's booleanIcons components.
export const BOOLEAN = {
  union: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="7" cy="10" r="5" fill="currentColor" stroke="none"/>
      <circle cx="13" cy="10" r="5" fill="currentColor" stroke="none"/>
      <circle cx="7" cy="10" r="5"/>
      <circle cx="13" cy="10" r="5"/>
    </g>`,
  intersect: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="7" cy="10" r="5"/>
      <circle cx="13" cy="10" r="5"/>
      <path d="M 10 6 A 5 5 0 0 1 10 14 A 5 5 0 0 1 10 6 Z" fill="currentColor" stroke="none"/>
    </g>`,
  subtract: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="7" cy="10" r="5"/>
      <circle cx="13" cy="10" r="5"/>
      <path d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z" fill="currentColor" stroke="none"/>
    </g>`,
  exclude: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="7" cy="10" r="5"/>
      <circle cx="13" cy="10" r="5"/>
      <path d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z M 10 6 A 5 5 0 1 1 10 14 A 5 5 0 0 1 10 6 Z" fill="currentColor" stroke="none" fill-rule="evenodd"/>
    </g>`,
  divide: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <circle cx="7" cy="10" r="5"/>
      <circle cx="13" cy="10" r="5"/>
      <line x1="10" y1="6" x2="10" y2="14"/>
    </g>`,
  crop: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <defs><clipPath id="weasel-default-crop-mask"><rect x="9" y="5" width="8" height="10"/>
      </clipPath>
      </defs>
      <circle cx="9" cy="10" r="5"/>
      <circle cx="9" cy="10" r="5" fill="currentColor" stroke="none" clip-path="url(#weasel-default-crop-mask)"/>
      <rect x="9" y="5" width="8" height="10"/>
    </g>`,
  trim: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z" stroke-linejoin="round"/>
      <circle cx="13" cy="10" r="5" fill="currentColor"/>
    </g>`,
  merge: `
    <g stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 1 0 10 6 Z" stroke-linejoin="round"/>
    </g>`,
};
