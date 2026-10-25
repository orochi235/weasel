// The BPMN symbols: events, activities, gateways, and data.

import { cylinder } from './network.mjs';

const circle = (cx, cy, r) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
const DIAMOND = 'M10 1.875 18.125 10 10 18.125 1.875 10Z';
const TASK = 'M5 3.75H15A2.5 2.5 0 0 1 17.5 6.25V13.75A2.5 2.5 0 0 1 15 16.25H5A2.5 2.5 0 0 1 2.5 13.75V6.25A2.5 2.5 0 0 1 5 3.75Z';
const NOTE = 'M4.375 1.875H11.875L15.625 5.625V18.125H4.375Z';
const store = cylinder(4.375, 15.625, 5, 15, 2.5);

const PENTAGON = (() => {
  const pts = [0, 1, 2, 3, 4].map((k) => {
    const t = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return `${(10 + 3.4 * Math.cos(t)).toFixed(3)} ${(10.3 + 3.4 * Math.sin(t)).toFixed(3)}`;
  });
  return `M${pts.join('L')}Z`;
})();

const gateway = (marker) => ({ d: DIAMOND + marker, join: 'miter' });

export const BPMN = {
  startEvent: `<path d="${circle(10, 10, 7.5)}"/>`,
  intermediateEvent: `<path d="${circle(10, 10, 7.5)}"/><path d="${circle(10, 10, 4.375)}"/>`,
  endEvent: `<path d="${circle(10, 10, 6.875)}" stroke-width="3"/>`,
  task: `<path d="${TASK}"/>`,
  subprocess: `<path d="${TASK}"/><path d="M7.5 9.375H12.5V14.375H7.5ZM10 10.625V13.125M8.75 11.875H11.25" stroke-width="1.25" stroke-linejoin="miter"/>`,
  exclusiveGateway: gateway('M7.5 7.5 12.5 12.5M12.5 7.5 7.5 12.5'),
  parallelGateway: gateway('M10 6.25V13.75M6.25 10H13.75'),
  inclusiveGateway: gateway(circle(10, 10, 3.4)),
  // At chrome size the circle round the pentagon closes up, so the glyph keeps the pentagon alone.
  eventGateway: `<path d="${DIAMOND}" stroke-linejoin="miter"/><path d="${PENTAGON}" stroke-width="1.25"/>`,
  dataObject: { d: `${NOTE}M11.875 1.875V5.625H15.625`, join: 'miter' },
  dataStore: `<path d="${store.body}"/><path d="${store.rim}"/>`,
};
