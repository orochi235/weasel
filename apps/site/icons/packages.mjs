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

  // A brush's footprint and its center: the size every brush tool shares.
  brush: `<circle cx="10" cy="10" r="5"/><path d="M10 10h0" stroke-width="2.5"/>`,

  clock: `<circle cx="10" cy="10" r="5.4"/><path d="M10 6.8V10l2.2 1.4"/>`,

  // A scene tree: a root and two children.
  core: `
    <circle cx="10" cy="5.6" r="1.6"/><circle cx="5.8" cy="14.2" r="1.6"/><circle cx="14.2" cy="14.2" r="1.6"/>
    <path d="M9.2 7 6.6 12.8M10.8 7l2.6 5.8"/>`,

  cursor: `<path d="M6.2 4.6v10l2.6-2.6 1.8 3.8 1.8-.8-1.8-3.8h3.6z"/>`,

  // Points joined to marks: three data dots and the bars they become.
  d3: `<path d="M5.6 15.4V12M10 15.4V8.4M14.4 15.4V5.6"/><path d="M5.6 7.2h0M10 4.8h0" stroke-width="2.5"/>`,

  devtools: `<path d="M7.6 6.4 4.8 10l2.8 3.6M12.4 6.4l2.8 3.6-2.8 3.6"/><path d="M11 5.4 9 14.6" stroke-width="1.25"/>`,

  // Two boxes and the elbow connector between them.
  diagram: `
    <rect x="4.6" y="4.6" width="4.4" height="3.6" rx="0.8"/>
    <rect x="11" y="11.8" width="4.4" height="3.6" rx="0.8"/>
    <path d="M6.8 8.2v5.4H11"/>`,

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

  font: `<path d="M5.2 15.4 10 4.6l4.8 10.8M7 11.4h6"/>`,

  // An anvil.
  forge: `<path d="${ANVIL}" fill="currentColor" stroke-width="1"/>`,

  // A right triangle and its square corner.
  geom: `<path d="M4.8 15.2h10.4L4.8 4.8z"/><path d="M4.8 12.6h2.6v2.6" stroke-width="1.25"/>`,

  // A closed hand pointing down at a surface: the fist with its curled fingers marked off, the index finger
  // dropping from its corner, and the marks of the touch either side of the fingertip.
  gestures: `
    <path d="M6.4 12.6V6.4a1.6 1.6 0 0 1 1.6-1.6h4.7a1.6 1.6 0 0 1 1.6 1.6V10a.95.95 0 0 1-1.9 0 .95.95 0 0 1-1.9 0 .95.95 0 0 1-1.9 0v2.6a1.1 1.1 0 0 1-2.2 0z" stroke-width="1.25"/>
    <path d="M4.6 15.4h10.8"/>
    <path d="M4.8 13.4 4 12.8M10.2 13.4l.8-.6" stroke-width="1.25"/>`,

  // A ruler guide each way, and a box snapped into their corner.
  guides: `<path d="M7.2 4.4v11.2M4.4 7.2h11.2" stroke-width="1.25" stroke-dasharray="1.6 1.4"/><rect x="7.2" y="7.2" width="6" height="6" rx="0.8"/>`,

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
  menu: `<path d="M5.4 5.6h9.2M5.4 14.4h9.2"/><rect x="4.4" y="8.4" width="11.2" height="3.2" rx="0.8" fill="currentColor" stroke="none"/>`,

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

  // A marquee, and the pointer dragging it.
  select: `<rect x="4.6" y="4.6" width="8" height="8" rx="0.8" stroke-width="1.25" stroke-dasharray="1.6 1.4"/><path d="M10.6 10.6v4.8l1.4-1.4 1.6 1.6 .8-.8-1.6-1.6 1.4-1.4z" fill="currentColor" stroke-width="1"/>`,

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
  // sides sit √2 · 1.77 = 2.5 apart: a stroke's width and a 1.0 gap.
  symmetry: `<path d="M4.6 4.6h9.03L4.6 13.63zM15.4 6.37v9.03H6.37z"/>`,

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
