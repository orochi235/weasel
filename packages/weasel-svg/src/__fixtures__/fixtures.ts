/**
 * Hand-rolled SVG fixtures embedded as TS module exports. We inline them
 * (rather than reading from disk) so vitest's resolver doesn't need a
 * Vite `?raw` plugin and tests stay portable.
 */

export const RECT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="10" y="20" width="50" height="30" fill="#ff0000" stroke="#000000" stroke-width="2"/>
</svg>`;

export const SHAPES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="40" cy="40" r="20" fill="#00ff00"/>
  <ellipse cx="100" cy="40" rx="30" ry="15" fill="rgb(0, 0, 255)"/>
  <line x1="10" y1="100" x2="150" y2="100" stroke="black" stroke-width="3"/>
  <polyline points="10,150 50,170 90,150 130,170" stroke="purple" stroke-width="2" fill="none"/>
  <polygon points="150,150 180,150 165,180" fill="orange"/>
</svg>`;

export const NESTED_GROUPS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g transform="translate(50,50)">
    <rect x="0" y="0" width="40" height="40" fill="#123456"/>
    <g transform="scale(2)">
      <circle cx="30" cy="30" r="10" fill="#abcdef"/>
    </g>
  </g>
</svg>`;

export const GRADIENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="100" y2="0">
      <stop offset="0" stop-color="#ff0000"/>
      <stop offset="1" stop-color="#0000ff"/>
    </linearGradient>
  </defs>
  <path d="M10 10 L90 10 L90 90 L10 90 Z" fill="url(#g1)" stroke="none"/>
</svg>`;

export const MULTI_CONTOUR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10 10 L90 10 L90 90 L10 90 Z M30 30 L70 30 L70 70 L30 70 Z" fill="#888888" stroke="#000000" stroke-width="1"/>
</svg>`;

export const CURVES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10 50 C 20 10, 40 10, 50 50 S 80 90, 90 50" fill="none" stroke="#005500" stroke-width="2"/>
  <path d="M10 80 Q 30 60, 50 80 T 90 80" fill="none" stroke="#550055" stroke-width="2"/>
</svg>`;

export const ROUNDED_RECT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">
  <rect x="5" y="5" width="90" height="50" rx="10" ry="10" fill="#fefefe" stroke="#222222" stroke-width="2"/>
</svg>`;

export const ARC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20 50 A 30 20 0 0 1 80 50" fill="none" stroke="#003355" stroke-width="2"/>
</svg>`;

export const STROKE_STYLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <line x1="10" y1="20" x2="90" y2="20" stroke="#000" stroke-width="4" stroke-linecap="round"/>
  <line x1="10" y1="40" x2="90" y2="40" stroke="#000" stroke-width="4" stroke-linecap="square"/>
  <polyline points="10,60 50,80 90,60" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
  <polyline points="10,75 50,95 90,75" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="bevel"/>
  <line x1="10" y1="90" x2="90" y2="90" stroke="#000" stroke-width="2" stroke-dasharray="6 3"/>
  <polyline points="10,5 15,15 20,5" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="miter" stroke-miterlimit="2"/>
</svg>`;

export const TEXT_PLAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <text x="10" y="20" dominant-baseline="text-before-edge" data-weasel-width="180" data-weasel-height="40" font-size="16" font-family="sans-serif" fill="#1a130d">Hello, world!</text>
</svg>`;

export const TEXT_RUNS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60">
  <text x="10" y="15" dominant-baseline="text-before-edge" data-weasel-width="220" data-weasel-height="30" font-size="18" font-family="sans-serif" fill="#1a130d"><tspan>Hello, </tspan><tspan font-weight="700">bold</tspan><tspan> and </tspan><tspan font-style="italic" fill="#b03030">red italic</tspan><tspan>.</tspan></text>
</svg>`;

/** Generic two-namespace fixture: proves weasel-svg passes through arbitrary
 *  namespaces without knowing what they mean. Uses two unrelated prefixes
 *  (`foo` and `bar`) so we exercise multi-namespace isolation. */
export const TWO_NAMESPACES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="https://example.com/foo" xmlns:bar="https://example.com/bar" viewBox="0 0 100 100" foo:rootAttr="alpha" bar:rootAttr="beta">
  <foo:registry>
    <foo:item id="a" name="Alpha"/>
    <foo:item id="b" name="Beta"/>
  </foo:registry>
  <g foo:group="g1" bar:tag="left">
    <path d="M 0 0 L 10 0 L 10 10 L 0 10 Z" fill="#000" foo:annotation="leaf"/>
  </g>
</svg>`;

/** Swillustrator-authored fixture: declares the `swill:` namespace, carries
 *  document title + paper-size metadata, and a couple of geometry leaves. */
export const SWILLUSTRATOR_MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 816 1056" width="816" height="1056" swill:paperSize="letter" swill:units="px">
  <title>My Doc</title>
  <path d="M 100 100 L 200 100 L 200 200 L 100 200 Z" fill="#3366ff" stroke="none"/>
  <text x="120" y="160" dominant-baseline="text-before-edge" data-weasel-width="60" data-weasel-height="20" font-size="16" font-family="sans-serif" fill="#000000">Hello</text>
</svg>`;

/** Same shape as SWILLUSTRATOR_MINIMAL_SVG but with the A4 preset, to prove
 *  the paper-size enum round-trips for non-default values. */
export const SWILLUSTRATOR_PAPERS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:swill="https://swillustrator.app/svg-ext" viewBox="0 0 794 1123" width="794" height="1123" swill:paperSize="a4" swill:units="px">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z" fill="#000000" stroke="none"/>
</svg>`;
