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
};
