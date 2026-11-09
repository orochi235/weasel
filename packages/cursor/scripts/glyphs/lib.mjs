// Geometry the glyph definitions share. Every helper writes the absolute
// M/L/A/Z dialect the fit guards in src/types.ts read.

export const n = (v) => Math.round(v * 100) / 100;

export const polar = (cx, cy, r, deg) => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy + r * Math.sin((deg * Math.PI) / 180),
];

export const closed = (pts) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${n(x)} ${n(y)}`).join(' ') + ' Z';

export const circle = (cx, cy, r) =>
  `M ${n(cx)} ${n(cy - r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy + r)} A ${r} ${r} 0 1 0 ${n(cx)} ${n(cy - r)} Z`;
