import { chevron } from '../../../packages/icons/scripts/lib/base.mjs';
import { framed } from './frame.mjs';

// One badge per published package, keyed by its unscoped name in camelCase: the Releases filter's
// package chips. Each body is drawn inside FRAME's clear area.

const atom = [0, 60, 120]
  .map((a) => `<ellipse cx="10" cy="10" rx="5.6" ry="2.1" transform="rotate(${a} 10 10)" stroke-width="1.1"/>`)
  .join('');

// The cartoon anvil, side on: a flat face, the horn tapering to a point on the left with its
// underside sweeping into the waist, a squared heel on the right, and feet flaring at the base.
const ANVIL =
  'M4.4 7H15.6V8.9H13.4C12.4 8.9 11.8 9.6 11.8 10.5V11.4C11.8 12.3 12.8 12.8 13.8 13V14H6.6V13C7.6 12.8 8.6 12.3 8.6 11.4V10.4C8.6 8.6 7 7.6 4.4 7Z';

/** A planet and an inclined orbit seen nearly edge-on: the orbit's far half passes behind the planet,
 *  its near half crosses in front, and the planet's rim is cut where the near half crosses it. Drawn
 *  level about the origin, then tilted. */
function orbiting() {
  const R = 3.8;
  const [RX, RY] = [6.5, 1.3];
  const [RIM_W, ORBIT_W, GAP] = [1.2, 1, 0.45];
  const TILT = -22;
  const f = (v) => Math.round(v * 1000) / 1000;
  const rad = (deg) => (deg * Math.PI) / 180;
  const onRim = (deg) => [R * Math.cos(rad(deg)), R * Math.sin(rad(deg))];
  const onOrbit = (deg) => [RX * Math.cos(rad(deg)), RY * Math.sin(rad(deg))];
  // The near half is the orbit's 0–180° (y-down: below the center), the far half 180–360°.
  const near = Array.from({ length: 721 }, (_, i) => onOrbit(i / 4));
  const toNear = ([x, y]) => Math.min(...near.map(([u, v]) => Math.hypot(x - u, y - v)));
  // Round caps reach half a stroke past an end, so an end stops both half-widths and the gap clear.
  const rimClear = RIM_W / 2 + GAP + ORBIT_W / 2;
  // Runs of whole degrees that pass `keep`, as path data along `point`, drawn as arcs of `rx ry`.
  const runs = (from, to, point, keep, [rx, ry]) => {
    const parts = [];
    let start = null;
    for (let d = from; d <= to; d += 0.25) {
      const ok = keep(point(d));
      if (ok && start === null) start = d;
      if ((!ok || d + 0.25 > to) && start !== null) {
        const end = ok ? d : d - 0.25;
        const [x0, y0] = point(start).map(f);
        const [x1, y1] = point(end).map(f);
        parts.push(`M${x0} ${y0}A${rx} ${ry} 0 ${end - start > 180 ? 1 : 0} 1 ${x1} ${y1}`);
        start = null;
      }
    }
    return parts.join('');
  };
  const rim = runs(0, 360, onRim, (p) => toNear(p) >= rimClear, [R, R]);
  const far = runs(180, 360, onOrbit, ([x, y]) => Math.hypot(x, y) >= R + rimClear, [RX, RY]);
  const [moonX, moonY] = onOrbit(145).map(f);
  return `
    <g transform="translate(10 10) rotate(${TILT})">
      <path d="${rim}" stroke-width="${RIM_W}"/>
      <path d="${far}M${RX} 0A${RX} ${RY} 0 0 1 ${-RX} 0" stroke-width="${ORBIT_W}"/>
      <circle cx="${moonX}" cy="${moonY}" r="1.3" fill="currentColor" stroke="none"/>
    </g>`;
}

export const PACKAGES = framed({
  // An ease-in-out curve with its start and end held.
  animator: `<path d="M4.6 15.4C9 15.4 11 4.6 15.4 4.6"/><path d="M4.6 15.4h0M15.4 4.6h0" stroke-width="2.6"/>`,

  // A level meter: bars of a waveform.
  audio: `<path d="M5 9v2M7.5 6.6v6.8M10 4.6v10.8M12.5 7.8v4.4M15 9.2v1.6"/>`,

  // One run right over one run left.
  bidi: `
    <path d="M4.6 7.4h10.4"/><path d="${chevron([15.4, 7.4], [1, 0], 2.4, 45)}"/>
    <path d="M15.4 12.6H5"/><path d="${chevron([4.6, 12.6], [-1, 0], 2.4, 45)}"/>`,

  // A brush's footprint and its center: the size every brush tool shares.
  brush: `<circle cx="10" cy="10" r="5"/><path d="M10 10h0" stroke-width="2.4"/>`,

  clock: `<circle cx="10" cy="10" r="5.4"/><path d="M10 6.8V10l2.2 1.4"/>`,

  // A scene tree: a root and two children.
  core: `
    <circle cx="10" cy="5.6" r="1.6"/><circle cx="5.8" cy="14.2" r="1.6"/><circle cx="14.2" cy="14.2" r="1.6"/>
    <path d="M9.2 7 6.6 12.8M10.8 7l2.6 5.8"/>`,

  cursor: `<path d="M6.2 4.6v10l2.6-2.6 1.8 3.8 1.8-.8-1.8-3.8h3.6z"/>`,

  // Points joined to marks: three data dots and the bars they become.
  d3: `<path d="M5.6 15.4V12M10 15.4V8.4M14.4 15.4V5.6"/><path d="M5.6 7.2h0M10 4.8h0" stroke-width="2.2"/>`,

  devtools: `<path d="M7.6 6.4 4.8 10l2.8 3.6M12.4 6.4l2.8 3.6-2.8 3.6"/><path d="M11 5.4 9 14.6" stroke-width="1.2"/>`,

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
    <path d="M7.6 12.4h4.4" stroke-width="1.1"/><path d="M7.6 12.4h0M12 12.4h0" stroke-width="2.2"/>`,

  // A checkerboard of ink.
  dither: `
    <path fill="currentColor" stroke="none" d="M4.4 4.4h2.8v2.8H4.4zM10 4.4h2.8v2.8H10zM7.2 7.2H10V10H7.2zM12.8 7.2h2.8V10h-2.8zM4.4 10h2.8v2.8H4.4zM10 10h2.8v2.8H10zM7.2 12.8H10v2.8H7.2zM12.8 12.8h2.8v2.8h-2.8z"/>`,

  // A window with its menu bar and side panel.
  editor: `<rect x="4.6" y="5" width="10.8" height="10" rx="1.2"/><path d="M4.6 7.8h10.8M8 7.8V15"/>`,

  font: `<path d="M5.2 15.4 10 4.6l4.8 10.8M7 11.4h6"/>`,

  // An anvil.
  forge: `<path d="${ANVIL}" fill="currentColor" stroke-width="0.6"/>`,

  // A right triangle and its square corner.
  geom: `<path d="M4.8 15.2h10.4L4.8 4.8z"/><path d="M4.8 12.6h2.6v2.6" stroke-width="1.1"/>`,

  // A swipe: the touch point and the motion trailing it.
  gestures: `
    <circle cx="13" cy="10" r="2.2" fill="currentColor"/>
    <path d="M4.6 7.4h4.2M4.6 10h4.2M6.2 12.6h2.6" stroke-width="1.1"/>`,

  // A ruler guide each way, and a box snapped into their corner.
  guides: `<path d="M7.2 4.4v11.2M4.4 7.2h11.2" stroke-width="1.1" stroke-dasharray="1.6 1.4"/><rect x="7.2" y="7.2" width="6" height="6" rx="0.8"/>`,

  // A shell prompt.
  headless: `<path d="M5.2 6.6 8.6 10l-3.4 3.4M10.4 13.6h4.4"/>`,

  // Undo: back along a run, around and down.
  history: `<path d="M5 7.6h6.4a3.4 3.4 0 0 1 0 6.8H8.6"/><path d="${chevron([4.6, 7.6], [-1, 0], 2.4, 45)}"/>`,

  // A viewfinder over the scene: the corners a HUD sits in.
  hud: `<path d="M4.6 7.2V4.6h2.6M12.8 4.6h2.6v2.6M15.4 12.8v2.6h-2.6M7.2 15.4H4.6v-2.6"/><circle cx="10" cy="10" r="1.8"/>`,

  // A plug.
  iconsPlugin: `<path d="M8 4.4v2.8M12 4.4v2.8M6.4 7.2h7.2v2.4a3.6 3.6 0 0 1-7.2 0z M10 13.2v2.4"/>`,

  // Four plain shapes.
  icons: `
    <circle cx="7" cy="7" r="2.2"/><rect x="10.8" y="4.8" width="4.4" height="4.4" rx="0.4"/>
    <path d="M7 10.8 9.4 15.2H4.6z"/><path d="M13 10.8v4.4M10.8 13h4.4"/>`,

  kernel3d: `<path d="M10 4.4 15 7.2v5.6L10 15.6 5 12.8V7.2z"/><path d="M5 7.2 10 10l5-2.8M10 10v5.6"/>`,

  // A flask.
  labkit: `<path d="M8.4 4.6v4L5 14a1 1 0 0 0 .9 1.4h8.2A1 1 0 0 0 15 14l-3.4-5.4v-4M7.6 4.6h4.8"/><path d="M6.6 12h6.8" stroke-width="1.1"/>`,

  loupe: `<circle cx="8.6" cy="8.6" r="3.8"/><path d="M11.4 11.4 15.2 15.2"/>`,

  // A list with its highlighted row.
  menu: `<path d="M5.4 5.6h9.2M5.4 14.4h9.2"/><rect x="4.4" y="8.4" width="11.2" height="3.2" rx="0.8" fill="currentColor" stroke="none"/>`,

  // The overview and the viewport you drag in it.
  minimap: `<rect x="4.6" y="5.6" width="10.8" height="8.8" rx="1" stroke-width="1.1"/><rect x="6.6" y="7.4" width="4.6" height="3.8" rx="0.4" fill="currentColor" stroke="none"/>`,

  // A switch, thrown.
  modes: `<rect x="4.4" y="7" width="11.2" height="6" rx="3"/><circle cx="12.6" cy="10" r="1.6" fill="currentColor"/>`,

  // A label leaving the printer, with a line printed on it.
  pTouch: `<path d="M4.4 9V6.2a1 1 0 0 1 1-1h9.2a1 1 0 0 1 1 1V9z"/><path d="M6.4 9v6.2h7.2V9"/><path d="M8.2 12h3.6" stroke-width="1.1"/>`,

  // A fill and a stroke, the two paints of a shape.
  paint: `
    <rect x="4.6" y="4.6" width="6.6" height="6.6" rx="0.8" fill="currentColor"/>
    <rect x="8.8" y="8.8" width="6.6" height="6.6" rx="0.8"/>`,

  // Near and far ridges, each its own plane.
  parallax: `<path d="M4.4 11.2 7.6 7.6l2 2.2 2.4-3.4 3.6 4.8" stroke-width="1.1"/><path d="M4.4 15.2 8.4 12.2l3 1.8 4.2-2.6"/>`,

  // A pen nib.
  pathTools: `<path d="M10 15.4 6 9.6 7.8 4.6h4.4L14 9.6z"/><path d="M10 15.4v-3.8"/><circle cx="10" cy="10" r="1.2" stroke-width="1.1"/>`,

  // A page of text.
  pdf: `<path d="M5.4 4.6h5.6l3.6 3.6v7.2H5.4z"/><path d="M11 4.6v3.6h3.6"/><path d="M7.4 11h5.2M7.4 13.2h3.6" stroke-width="1.1"/>`,

  // Axes and a series on them.
  plot: `<path d="M4.8 4.6v10.6h10.6"/><path d="M7 12.6 9.6 9l2 1.8 3.4-4.4"/>`,

  // Two sliders.
  prefs: `
    <path d="M4.6 7.2h10.8M4.6 12.8h10.8" stroke-width="1.1"/>
    <circle cx="8" cy="7.2" r="1.6" fill="currentColor"/><circle cx="12.4" cy="12.8" r="1.6" fill="currentColor"/>`,

  // A ruler: numbers with units.
  quantity: `
    <rect x="4.4" y="6.8" width="11.2" height="6.4" rx="0.8"/>
    <path d="M6.6 6.8v1.6M8.8 6.8v2.8M11.2 6.8v1.6M13.4 6.8v2.8" stroke-width="1.1"/>`,

  react: `${atom}<circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/>`,

  // Keyed rows: a key and its entry.
  registry: `
    <path d="M4.8 6h0M4.8 10h0M4.8 14h0" stroke-width="2.4"/>
    <path d="M7.6 6h7.8M7.6 10h7.8M7.6 14h5.4"/>`,

  // A quad as the two triangles the GPU draws.
  renderer: `<path d="M4.8 4.8h10.4v10.4H4.8z"/><path d="M4.8 15.2 15.2 4.8" stroke-width="1.1"/><path d="M4.8 4.8h0M15.2 4.8h0M4.8 15.2h0M15.2 15.2h0" stroke-width="2.6"/>`,

  // A two-bone chain.
  rig: `<circle cx="5.6" cy="14.4" r="1.4"/><circle cx="9.4" cy="8" r="1.4"/><circle cx="14.6" cy="5.6" r="1.4"/><path d="M6.3 13.2 8.7 9.2M10.7 7.4l2.6-1.2"/>`,

  // One route in, the branches it is dispatched along.
  routing: `
    <path d="M4.4 10h3.4c2 0 2.8-3.4 5.4-3.4h1.4M7.8 10c2 0 2.8 3.4 5.4 3.4h1.4"/>
    <path d="M7.8 10h0" stroke-width="2.6"/>`,

  // A marquee, and the pointer dragging it.
  select: `<rect x="4.6" y="4.6" width="8" height="8" rx="0.8" stroke-width="1.1" stroke-dasharray="1.6 1.4"/><path d="M10.6 10.6v4.8l1.4-1.4 1.6 1.6 .8-.8-1.6-1.6 1.4-1.4z" fill="currentColor" stroke-width="1"/>`,

  // A body, the orbit it keeps, and the satellite on it.
  // A planet, lit from its moon's side, and the moon's orbit.
  simulation: orbiting(),

  storage: `
    <ellipse cx="10" cy="6.2" rx="4.8" ry="1.6"/>
    <path d="M5.2 6.2v7.6c0 .9 2.15 1.6 4.8 1.6s4.8-.7 4.8-1.6V6.2M5.2 10c0 .9 2.15 1.6 4.8 1.6s4.8-.7 4.8-1.6"/>`,

  // A ribbon that swells and tapers.
  stroke: `<path fill="currentColor" stroke-width="0.6" d="M4.6 15.2C7.4 15.4 8 8.6 15.4 4.8 10.4 9.6 9.4 13.6 4.6 15.2z"/>`,

  // A curve, its anchors and one handle.
  svg: `
    <path d="M5.2 14.4C5.2 8 9.4 6.4 14.8 5.6"/>
    <path d="M5.2 14.4V8.4" stroke-width="1"/>
    <rect x="4" y="13.2" width="2.4" height="2.4" fill="currentColor" stroke="none"/>
    <rect x="13.6" y="4.4" width="2.4" height="2.4" fill="currentColor" stroke="none"/>
    <path d="M5.2 8.4h0" stroke-width="2.4"/>`,

  // Two halves mirrored across an axis.
  symmetry: `<path d="M10 4.4v11.2" stroke-width="1.1" stroke-dasharray="1.6 1.4"/><path d="M8 6 4.6 13.6H8zM12 6l3.4 7.6H12z"/>`,

  // A paragraph, wrapped.
  text: `<path d="M4.8 5.8h10.4M4.8 8.6h10.4M4.8 11.4h10.4M4.8 14.2h6"/>`,

  // A caret in a line of text.
  textDom: `<path d="M10 5v10M8.4 5h3.2M8.4 15h3.2"/><path d="M4.6 10h3M12.4 10h3" stroke-width="1.1"/>`,

  // A joined, cursive run with a dot set below it.
  textShaping: `<path d="M4.4 11.2c1.4 0 1.6-2.8 3-2.8s1.4 2.8 2.8 2.8 1.4-4.4 2.8-4.4c.9 0 1.2 1 1.2 2.2v2.2"/><path d="M7.4 14h0" stroke-width="2.2"/>`,

  // Light and dark halves of one disc.
  theme: `<circle cx="10" cy="10" r="5.2"/><path d="M10 4.8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor"/>`,

  // A checkbox, checked, and a toggle beside it.
  ui: `
    <rect x="4.6" y="4.6" width="4.4" height="4.4" rx="0.8"/><path d="M5.8 6.8 6.6 7.6 8 5.8" stroke-width="1.1"/>
    <path d="M10.8 6.8h4.6"/>
    <rect x="4.6" y="11" width="10.8" height="4.4" rx="2.2"/><circle cx="13.2" cy="13.2" r="1.2" fill="currentColor"/>`,

  // The four ways a key moves focus.
  uiInput: `
    <path d="M10 6v8M6 10h8" stroke-width="1.1"/>
    <path d="${chevron([10, 4.6], [0, -1], 2.2, 45)}M${chevron([10, 15.4], [0, 1], 2.2, 45).slice(1)}M${chevron([4.6, 10], [-1, 0], 2.2, 45).slice(1)}M${chevron([15.4, 10], [1, 0], 2.2, 45).slice(1)}"/>`,

  // A box with its measured width.
  uiLogic: `<rect x="4.6" y="8.4" width="10.8" height="7" rx="1"/><path d="M4.6 4.4v2M15.4 4.4v2M4.6 5.4h10.8" stroke-width="1.1"/>`,
});
