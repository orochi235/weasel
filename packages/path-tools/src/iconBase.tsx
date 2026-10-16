/** What every path-tools icon shares: core's action-glyph register, a 20x20
 *  viewBox stroked in `currentColor`, with path edit's marks — a filled
 *  square for an anchor, a filled circle for a knob. */
export const SVG_BASE = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const DOT = { fill: 'currentColor', stroke: 'none' };

/** An anchor's filled square, centered on (x, y). */
export const anchor = (x: number, y: number) => <rect x={x - 1.5} y={y - 1.5} width="3" height="3" {...DOT} />;
