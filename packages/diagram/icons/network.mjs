// The network devices. Straight runs sit on odd multiples of 0.625, as the
// container glyphs' do, so a 1.5 stroke lands on whole pixels at 16px.

const circle = (cx, cy, r) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;


/** A cylinder standing in `left`..`right`, its caps centered at `top` and `bottom`. */
export const cylinder = (left, right, top, bottom, ry) => {
  const rx = (right - left) / 2;
  return {
    body: `M${left} ${top}A${rx} ${ry} 0 0 1 ${right} ${top}V${bottom}A${rx} ${ry} 0 0 1 ${left} ${bottom}Z`,
    rim: `M${left} ${top}A${rx} ${ry} 0 0 0 ${right} ${top}`,
  };
};

const db = cylinder(4.375, 15.625, 5, 15, 2.5);
const router = cylinder(1.875, 18.125, 5.625, 14.375, 2.5);
const SERVER = 'M5.625 1.875H14.375V18.125H5.625Z';
const SWITCH = 'M1.875 4.375H18.125V15.625H1.875Z';
const WALL = 'M3.125 3.125H16.875V18.125H3.125Z';
const SCREEN = 'M4.375 4.375H15.625V13.125H4.375Z';
const MONITOR = 'M3.125 3.125H16.875V13.125H3.125Z';
const PHONE = 'M7.5 1.875H12.5Q13.75 1.875 13.75 3.125V16.875Q13.75 18.125 12.5 18.125H7.5Q6.25 18.125 6.25 16.875V3.125Q6.25 1.875 7.5 1.875Z';
const PRINTER = 'M3.125 6.875H16.875V14.375H3.125Z';
const CLOUD = 'M5.625 15.625H14.375A3.75 3.75 0 0 0 15 8.2A5 5 0 0 0 5.6 7.6A4 4 0 0 0 5.625 15.625Z';

export const NETWORK = {
  server: `<path d="${SERVER}M8.125 5H11.875M8.125 7.5H11.875" stroke-linejoin="miter"/><path d="M11 14.375A1 1 0 1 1 9 14.375A1 1 0 1 1 11 14.375Z" fill="currentColor" stroke="none"/>`,
  database: `<path d="${db.body}"/><path d="${db.rim}"/>`,
  cloud: `<path d="${CLOUD}"/>`,
  // Heads on the crossing would merge into one bar at chrome size, so the glyph crosses bare strokes.
  router: `<path d="${router.body}"/><path d="${router.rim}"/><path d="M7.5 10.625 12.5 15M7.5 15 12.5 10.625"/>`,
  switch: { d: `${SWITCH}M5 8.125H15M13.125 6.25 15 8.125 13.125 10M15 11.875H5M6.875 10 5 11.875 6.875 13.75`, join: 'miter' },
  firewall: {
    d: `${WALL}M3.125 6.875H16.875M3.125 10.625H16.875M3.125 14.375H16.875`
      + 'M10 3.125V6.875M6.875 6.875V10.625M13.125 6.875V10.625M10 10.625V14.375M6.875 14.375V18.125M13.125 14.375V18.125',
    join: 'miter',
  },
  laptop: { d: `${SCREEN}M4.375 13.125 1.875 16.875H18.125L15.625 13.125`, fill: SCREEN, join: 'miter' },
  desktop: { d: `${MONITOR}M10 13.125V16.875M6.875 16.875H13.125`, fill: MONITOR, join: 'miter' },
  phone: { d: `${PHONE}M9.375 15.625H10.625` },
  printer: { d: `${PRINTER}M5.625 6.875V1.875H14.375V6.875M5.625 11.875H14.375V18.125H5.625Z`, join: 'miter' },
  user: `<path d="${circle(10, 6.25, 3.125)}"/><path d="M3.75 17.5A6.25 5.625 0 0 1 16.25 17.5"/>`,
  internet: `<path d="${circle(10, 10, 7.5)}"/><path d="M2.5 10H17.5M10 2.5A3.4 7.5 0 0 0 10 17.5A3.4 7.5 0 0 0 10 2.5"/>`,
};

