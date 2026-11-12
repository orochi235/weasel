import { chevron } from '../../../packages/icons/scripts/lib/base.mjs';
import { framed } from './frame.mjs';
import { planet } from './planet.mjs';
import { cylinder } from '../../../packages/diagram/icons/network.mjs';

// One badge per published package, keyed by its unscoped name in camelCase: the Releases filter's
// package chips. Each body is drawn inside FRAME's clear area.

const atom = [0, 60, 120]
  .map((a) => `<ellipse cx="10" cy="10" rx="5.6" ry="2.1" transform="rotate(${a} 10 10)" stroke-width="1.25"/>`)
  .join('');

// The cartoon anvil, side on: a flat face, the horn tapering to a point on the left with its
// underside sweeping into the waist, a squared heel on the right, and feet flaring at the base.
const ANVIL =
  'M4.4 7H15.6V8.9H13.4C12.4 8.9 11.8 9.6 11.8 10.5V11.4C11.8 12.3 12.8 12.8 13.8 13V14H6.6V13C7.6 12.8 8.6 12.3 8.6 11.4V10.4C8.6 8.6 7 7.6 4.4 7Z';

const DB = cylinder(4.375, 15.625, 6.6, 13.4, 1.9);

/** A slider at height `y` with a hollow thumb at `x`. The track passes behind the thumb, so each half is a
 *  filled band ending on the thumb's outline grown by a gap; the band crosses the thumb on a radius, so that
 *  end is concentric with the thumb. */
function slider(y, x) {
  const [X0, X1, H, THUMB, THUMB_W, GAP] = [4.6, 15.4, 0.5, 1.4, 1.25, 0.5];
  const cut = THUMB + THUMB_W / 2 + GAP;
  const dx = Math.sqrt(cut * cut - H * H);
  const r = (v) => Math.round(v * 1000) / 1000;
  const [top, bot] = [r(y - H), r(y + H)];
  const left = r(x - dx);
  const right = r(x + dx);
  const leftBand = `M${X0} ${top}H${left}A${cut} ${cut} 0 0 0 ${left} ${bot}H${X0}A${H} ${H} 0 0 1 ${X0} ${top}Z`;
  const rightBand = `M${X1} ${top}H${right}A${cut} ${cut} 0 0 1 ${right} ${bot}H${X1}A${H} ${H} 0 0 0 ${X1} ${top}Z`;
  return `<path d="${leftBand}${rightBand}" fill="currentColor" stroke="none"/><circle cx="${x}" cy="${y}" r="${THUMB}" stroke-width="${THUMB_W}"/>`;
}

export const PACKAGES = framed({
  // An ease-in-out curve with its start and end held.
  animator: `<path d="M4.6 15.4C9 15.4 11 4.6 15.4 4.6"/><path d="M4.6 15.4h0M15.4 4.6h0" stroke-width="2.5"/>`,

  // A level meter: bars of a waveform.
  audio: `<path d="M5 9v2M7.5 6.6v6.8M10 4.6v10.8M12.5 7.8v4.4M15 9.2v1.6"/>`,

  // One run right over one run left, each head keeping only the barb away from the other run.
  bidi: `<path d="M4.6 8.2h10.8l-2-2M15.4 11.8H4.6l2 2"/>`,

  // A paintbrush on the diagonal: handle, square ferrule, and a teardrop head pressed flat on a surface at y=16.
  brush: `<path d="M15.5 4.5L11.5 8.5M10.3 7.3L12.7 9.7L10.7 11.7L8.3 9.3zM8.3 9.3C6.6 11.4 5 13.6 5.5 16H12.5C13 14 12.6 12.6 10.7 11.7"/>`,

  clock: `<circle cx="10" cy="10" r="5.4"/><path d="M10 6.8V10l2.2 1.4"/>`,

  // A scene tree: a root and two children.
  core: `
    <circle cx="10" cy="5.6" r="1.6"/><circle cx="5.8" cy="14.2" r="1.6"/><circle cx="14.2" cy="14.2" r="1.6"/>
    <path d="M9.2 7 6.6 12.8M10.8 7l2.6 5.8"/>`,

  cursor: `<path d="M6.2 4.6v10l2.6-2.6 1.8 3.8 1.8-.8-1.8-3.8h3.6z"/>`,

  // "d3" in Fira Mono SemiBold (Fira Code's d and 3 are Fira Mono's), outlined so no font has to load.
  d3: `<path d="M8.23 8.91L8.23 6.55L9.41 6.67L9.41 13.32L8.36 13.32L8.29 12.76Q8.07 13.07 7.74 13.26Q7.41 13.45 6.97 13.45L6.97 13.45Q6.37 13.45 5.97 13.14Q5.58 12.83 5.39 12.26Q5.20 11.69 5.20 10.94L5.20 10.94Q5.20 10.22 5.43 9.65Q5.65 9.08 6.07 8.76Q6.50 8.43 7.08 8.43L7.08 8.43Q7.77 8.43 8.23 8.91L8.23 8.91ZM7.40 9.32L7.40 9.32Q6.95 9.32 6.69 9.71Q6.43 10.09 6.43 10.94L6.43 10.94Q6.43 11.84 6.67 12.20Q6.91 12.57 7.31 12.57L7.31 12.57Q7.61 12.57 7.83 12.39Q8.06 12.21 8.23 11.95L8.23 11.95L8.23 9.78Q8.06 9.56 7.86 9.44Q7.65 9.32 7.40 9.32ZM12.57 6.98L12.57 6.98Q13.20 6.98 13.66 7.19Q14.12 7.41 14.36 7.77Q14.60 8.12 14.60 8.56L14.60 8.56Q14.60 9.14 14.25 9.51Q13.90 9.89 13.36 10.03L13.36 10.03Q13.76 10.08 14.09 10.25Q14.41 10.42 14.61 10.74Q14.80 11.07 14.80 11.56L14.80 11.56Q14.80 12.09 14.52 12.52Q14.23 12.95 13.72 13.20Q13.20 13.45 12.49 13.45L12.49 13.45Q11.85 13.45 11.32 13.23Q10.78 13.00 10.40 12.56L10.40 12.56L11.10 11.93Q11.36 12.24 11.71 12.39Q12.05 12.53 12.42 12.53L12.42 12.53Q12.95 12.53 13.26 12.26Q13.58 11.99 13.58 11.49L13.58 11.49Q13.58 10.94 13.27 10.71Q12.97 10.48 12.45 10.48L12.45 10.48L11.90 10.48L12.04 9.64L12.43 9.64Q12.85 9.64 13.15 9.41Q13.45 9.19 13.45 8.73L13.45 8.73Q13.45 8.33 13.16 8.10Q12.88 7.87 12.45 7.87L12.45 7.87Q12.07 7.87 11.77 8.02Q11.47 8.16 11.18 8.43L11.18 8.43L10.57 7.77Q11.40 6.98 12.57 6.98Z" fill="currentColor" stroke="none"/>`,

  devtools: `<path d="M6.8 6.4 4 10l2.8 3.6M13.2 6.4l2.8 3.6-2.8 3.6"/><path d="M11 5.4 9 14.6" stroke-width="1.25"/>`,

  // A decision diamond branching to two boxes.
  diagram: `
    <path d="M6.8 5.5L9.4 7.7L6.8 9.9L4.2 7.7Z"/>
    <rect x="11" y="5.9" width="4.4" height="3.6" rx="0.8"/>
    <rect x="11" y="11.8" width="4.4" height="3.6" rx="0.8"/>
    <path d="M9.4 7.7H11M6.8 9.9v3.7H11" stroke-width="1.25"/>`,

  // A layered layout: one node over two, routed orthogonally.
  diagramElk: `
    <rect x="8" y="4.6" width="4" height="3" rx="0.6"/>
    <rect x="4.6" y="12.4" width="4" height="3" rx="0.6"/><rect x="11.4" y="12.4" width="4" height="3" rx="0.6"/>
    <path d="M10 7.6v2.4M6.6 12.4V10h6.8v2.4"/>`,

  // A page holding a node and a link.
  diagramFormats: `
    <path d="M5.4 4.6h5.6l3.6 3.6v7.2H5.4z"/><path d="M11 4.6v3.6h3.6"/>
    <path d="M7.6 12.4h4.4" stroke-width="1.25"/><path d="M7.6 12.4h0M12 12.4h0" stroke-width="2.5"/>`,

  // A checkerboard of ink.
  dither: `
    <path fill="currentColor" stroke="none" d="M4.4 4.4h2.8v2.8H4.4zM10 4.4h2.8v2.8H10zM7.2 7.2H10V10H7.2zM12.8 7.2h2.8V10h-2.8zM4.4 10h2.8v2.8H4.4zM10 10h2.8v2.8H10zM7.2 12.8H10v2.8H7.2zM12.8 12.8h2.8v2.8h-2.8z"/>`,

  // A window with its menu bar and side panel.
  editor: `<rect x="4.6" y="5" width="10.8" height="10" rx="1.2"/><path d="M4.6 7.8h10.8M8 7.8V15"/>`,

  // A capital F in Source Serif 4 (SIL OFL), outlined so no font has to load.
  font: `<path d="M10.47 15L6.23 15L6.23 14.39L8.19 14.16L8.51 14.16L10.47 14.39L10.47 15M9.1 15L7.59 15Q7.62 14.24 7.63 13.48Q7.63 12.72 7.63 11.93Q7.63 11.15 7.63 10.37L7.63 10.37L7.63 9.64Q7.63 8.87 7.63 8.09Q7.63 7.31 7.63 6.54Q7.62 5.76 7.59 5L7.59 5L9.1 5Q9.08 5.75 9.07 6.52Q9.05 7.3 9.05 8.07Q9.05 8.85 9.05 9.64L9.05 9.64L9.05 10.19Q9.05 11.04 9.05 11.86Q9.05 12.67 9.07 13.45Q9.08 14.22 9.1 15L9.1 15M11.83 10.25L8.34 10.25L8.34 9.55L11.83 9.55L11.83 10.25M12.26 11.81L11.57 11.81L11.35 10.15L11.35 9.7L11.57 8.13L12.26 8.13L12.26 11.81M8.19 5.84L6.23 5.61L6.23 5L8.34 5L8.34 5.84L8.19 5.84M13.77 7.64L12.92 7.64L12.51 5.3L13.04 5.75L8.34 5.75L8.34 5L13.66 5L13.77 7.64" fill="currentColor" stroke="none"/>`,

  // An anvil.
  forge: `<path d="${ANVIL}" fill="currentColor" stroke-width="1"/>`,

  // A right triangle and its square corner.
  geom: `<path d="M4.8 15.2h10.4L4.8 4.8z"/><path d="M4.8 12.6h2.6v2.6" stroke-width="1"/>`,

  // A figure waving: a head, a body standing on two legs, one arm low and the other raised, and a motion arc
  // beside the raised hand.
  gestures: `
    <circle cx="8.6" cy="5.8" r="1.9" stroke-width="1.25"/>
    <path d="M8.6 8.8V12.6M8.6 12.6 6.4 16M8.6 12.6 10.8 16M8.6 11 6.4 13.2M8.6 11l3.6-3.6" stroke-width="1.25"/>
    <path d="M13.74 5.56A2.4 2.4 0 0 1 14.04 8.94" stroke-width="1.25"/>`,

  // A grid of nine cells.
  guides: `<rect x="5.908" y="5.908" width="8.184" height="8.184" rx="0.868"/><path d="M8.636 5.908v8.184M11.364 5.908v8.184M5.908 8.636h8.184M5.908 11.364h8.184" stroke-width="1"/>`,

  // A shell prompt.
  headless: `<path d="M5.2 6.6 8.6 10l-3.4 3.4M10.4 13.6h4.4"/>`,

  // Undo: back along a run, around and down.
  history: `<path d="M5 7.6h6.4a3.4 3.4 0 0 1 0 6.8H8.6"/><path d="${chevron([4.6, 7.6], [-1, 0], 2.4, 45)}"/>`,

  // A viewfinder over the scene: the corners a HUD sits in.
  hud: `<path d="M4.6 7.2V4.6h2.6M12.8 4.6h2.6v2.6M15.4 12.8v2.6h-2.6M7.2 15.4H4.6v-2.6"/><circle cx="10" cy="10" r="1.8"/>`,

  // A plug.
  iconsPlugin: `<path d="M8 4.4v2.8M12 4.4v2.8M6.4 7.2h7.2v2.4a3.6 3.6 0 0 1-7.2 0z M10 13.2v2.4"/>`,

  // Four plain shapes.
  icons: `<g stroke-width="1.25">
    <circle cx="7" cy="7" r="1.8"/><path d="M13 5.2v3.6M11.2 7h3.6"/>
    <path d="M7 11.1 8.9 14.6H5.1z"/><rect x="11.2" y="11.2" width="3.6" height="3.6" rx="0.3"/></g>`,

  kernel3d: `<path d="M10 4.4 15 7.2v5.6L10 15.6 5 12.8V7.2z"/><path d="M5 7.2 10 10l5-2.8M10 10v5.6"/>`,

  // A flask.
  labkit: `<path d="M8.4 4.6v4L5 14a1 1 0 0 0 .9 1.4h8.2A1 1 0 0 0 15 14l-3.4-5.4v-4M7.6 4.6h4.8"/><path d="M6.6 12h6.8" stroke-width="1.25"/>`,

  // A jeweler's loupe in three-quarter view: the lens rim facing up and left, the barrel running down and
  // right behind it, and a glint on the glass. The barrel's sides leave the rim at the ends of its long axis,
  // where the rim's tangent runs along the barrel.
  loupe: `
    <g stroke-width="1.25">
    <path d="M11.711 5.489 14.111 7.889A4.4 3 -45 0 1 7.889 14.111L5.489 11.711A4.4 3 -45 0 1 11.711 5.489z"/>
    <path d="M11.711 5.489A4.4 3 -45 0 1 5.489 11.711"/></g>
    <path d="M6.6 9.2 A2.6 1.6 -45 0 1 9.2 6.6" stroke-width="1"/>`,

  // A list with its highlighted row.
  menu: `<path d="M5.4 5.6h9.2M5.4 14.4h9.2"/><rect x="4.65" y="8.4" width="10.7" height="3.2" rx="0.75" fill="currentColor" stroke="none"/>`,

  // The overview and the viewport you drag in it.
  minimap: `<rect x="4.6" y="5.6" width="10.8" height="8.8" rx="1" stroke-width="1.25"/><rect x="6.6" y="7.4" width="4.6" height="3.8" rx="0.4" fill="currentColor" stroke="none"/>`,

  // A switch, thrown.
  modes: `<rect x="4.4" y="7" width="11.2" height="6" rx="3"/><circle cx="12.6" cy="10" r="1.6" fill="currentColor"/>`,

  // A label leaving the printer, with a line printed on it.
  pTouch: `<path d="M4.4 9V6.2a1 1 0 0 1 1-1h9.2a1 1 0 0 1 1 1V9z"/><path d="M6.4 9v6.2h7.2V9"/><path d="M8.2 12h3.6" stroke-width="1.25"/>`,

  // A fill and a stroke, the two paints of a shape.
  paint: `
    <rect x="4.6" y="4.6" width="6.6" height="6.6" rx="0.8" fill="currentColor"/>
    <rect x="8.8" y="8.8" width="6.6" height="6.6" rx="0.8"/>`,

  // Near and far ridges, each its own plane.
  parallax: `
    <circle cx="13" cy="6.6" r="1.6"/>
    <path d="M10.6 14.4C11.4 12 13.6 11.2 15.6 12" stroke-width="1.25"/>
    <path d="M7 5 9.4 11.2H4.6z"/><path d="M7 11.2v3.2M4.4 14.4h11.2"/>`,

  // A pen nib.
  pathTools: `<g stroke-width="1.25"><path d="M10 15.4 6 9.6 7.8 4.6h4.4L14 9.6z"/><path d="M10 15.4v-3.8"/><circle cx="10" cy="10" r="1.2" stroke-width="1"/></g>`,

  // A page of text.
  pdf: `<path d="M5.4 4.6h5.6l3.6 3.6v7.2H5.4z"/><path d="M11 4.6v3.6h3.6"/><path d="M7.4 11h5.2M7.4 13.2h3.6" stroke-width="1.25"/>`,

  // Axes and a series on them.
  plot: `<path d="M4.8 4.6v10.6h10.6"/><path d="M7 12.6 9.6 9l2 1.8 3.4-4.4"/>`,

  // Two sliders.
  prefs: `${slider(7.2, 8.6)}${slider(12.8, 11.4)}`,

  // A ruler: numbers with units.
  // Vernier calipers: the beam with its fixed jaw, the slider riding it with the moving jaw, and the scale.
  quantity: `<g stroke-width="1.25">
    <path d="M9 5.6H5.4a1 1 0 0 0-1 1V7.8L6.6 14.6V7.8H9M12.4 5.6h3.2v2.2h-3.2"/>
    <rect x="9" y="4.6" width="3.4" height="4.2" rx="0.6"/>
    <path d="M9.6 8.8v5.8L11.8 8.8"/>
    <path d="M13.6 7.8v-1M14.8 7.8v-1" stroke-width="1"/></g>`,

  react: `${atom}<circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/>`,

  // Keyed rows: a key and its entry.
  registry: `
    <path d="M4.8 6h0M4.8 10h0M4.8 14h0" stroke-width="2.5"/>
    <path d="M7.6 6h7.8M7.6 10h7.8M7.6 14h5.4"/>`,

  // A quad as the two triangles the GPU draws.
  renderer: `<path d="M4.8 4.8h10.4v10.4H4.8z"/><path d="M4.8 15.2 15.2 4.8" stroke-width="1.25"/><path d="M4.8 4.8h0M15.2 4.8h0M4.8 15.2h0M15.2 15.2h0" stroke-width="2.5"/>`,

  // A two-bone chain.
  rig: `<circle cx="5.6" cy="14.4" r="1.4"/><circle cx="9.4" cy="8" r="1.4"/><circle cx="14.6" cy="5.6" r="1.4"/><path d="M6.3 13.2 8.7 9.2M10.7 7.4l2.6-1.2"/>`,

  // One route in, the branches it is dispatched along.
  routing: `
    <path d="M4.4 10h3.4c2 0 2.8-3.4 5.4-3.4h1.4M7.8 10c2 0 2.8 3.4 5.4 3.4h1.4"/>
    <path d="M7.8 10h0" stroke-width="2.5"/>`,

  // A marquee: a dashed box centered in the frame.
  select: `<rect x="5" y="5" width="10" height="10" stroke-dasharray="2.5 1.5"/>`,

  // A body, the orbit it keeps, and the satellite on it.
  // A planet, lit from its moon's side, and the moon's orbit.
  simulation: planet(),

  // diagram's database, drawn by its own `cylinder` at the frame's inner size.
  storage: `<path d="${DB.body}"/><path d="${DB.rim}"/>`,

  // A ribbon that swells and tapers.
  stroke: `<path fill="currentColor" stroke-width="1" d="M4.6 15.2C7.4 15.4 8 8.6 15.4 4.8 10.4 9.6 9.4 13.6 4.6 15.2z"/>`,

  // A curve, its anchors and one handle.
  svg: `
    <path d="M5.2 14.4C5.2 8 9.4 6.4 14.8 5.6"/>
    <path d="M5.2 14.4V8.4" stroke-width="1"/>
    <rect x="4" y="13.2" width="2.4" height="2.4" fill="currentColor" stroke="none"/>
    <rect x="13.6" y="4.4" width="2.4" height="2.4" fill="currentColor" stroke="none"/>
    <path d="M5.2 8.4h0" stroke-width="2.5"/>`,

  // Two halves mirrored across an axis.
  // A square split on its diagonal into two mirrored halves, each with its own border. The halves' long
  // sides sit 5.05 apart, 2.52 either side of the dashed axis (x + y = 20).
  symmetry: `<path stroke-width="1.25" d="M3.7 3.7h9.03L3.7 12.73zM16.3 7.27v9.03H7.27z"/><path stroke-width="1" stroke-dasharray="1.5 2.5" d="M5.23 14.77L14.77 5.23"/>`,

  // A paragraph, wrapped.
  text: `<path d="M4.8 5.8h10.4M4.8 8.6h10.4M4.8 11.4h10.4M4.8 14.2h6"/>`,

  // A caret in a line of text.
  textDom: `<path d="M10 5v10M8.4 5h3.2M8.4 15h3.2"/><path d="M4.6 10h3M12.4 10h3" stroke-width="1.25"/>`,

  // A joined, cursive run with a dot set below it.
  textShaping: `<path d="M4.4 11.2c1.4 0 1.6-2.8 3-2.8s1.4 2.8 2.8 2.8 1.4-4.4 2.8-4.4c.9 0 1.2 1 1.2 2.2v2.2"/><path d="M7.4 14h0" stroke-width="2.5"/>`,

  // Light and dark halves of one disc.
  // A painter's palette: its thumb hole, and wells of paint, one full, two empty.
  theme: `
    <path d="M10 4.6c3.2 0 5.4 2.1 5.4 4.6 0 1.7-1.2 2.6-2.6 2.6-1 0-1.6.5-1.6 1.3 0 .5.4.9.4 1.4 0 .7-.7 .9-1.6.9-3 0-5.4-2.3-5.4-5.4s2.4-5.4 5.4-5.4z"/>
    <circle cx="7.6" cy="8.2" r="1" fill="currentColor"/><circle cx="10.6" cy="7" r="0.9" stroke-width="1.25"/>
    <circle cx="7.6" cy="11.6" r="0.9" stroke-width="1.25"/><circle cx="13" cy="8.8" r="0.7" stroke-width="1.25"/>`,

  // A checkbox, checked, and a toggle beside it.
  ui: `
    <path d="M4.8 6.8 6.4 8.4 9.2 5"/><path d="M11 6.8h4.4"/>
    <rect x="4.6" y="10.4" width="10.8" height="5" rx="2.5"/><circle cx="12.9" cy="12.9" r="1.1" fill="currentColor"/>`,

  // The text cursor: a stem whose ends curl out into serifs either side.
  uiInput: `<path d="M10 6.4v7.2M7.8 4.6c1.4 0 2.2.6 2.2 1.8 0-1.2.8-1.8 2.2-1.8M7.8 15.4c1.4 0 2.2-.6 2.2-1.8 0 1.2.8 1.8 2.2 1.8" stroke-width="1.25"/>`,

  // A box with its measured width.
  uiLogic: `<rect x="4.6" y="8.4" width="10.8" height="7" rx="1"/><path d="M4.6 4.4v2M15.4 4.4v2M4.6 5.4h10.8" stroke-width="1.25"/>`,
});
