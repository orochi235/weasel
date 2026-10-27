import type { PathSnapKind } from '@weasel-js/geom';

/** What the snap readout calls each kind of path target. */
export const PATH_SNAP_LABELS: Readonly<Record<PathSnapKind, string>> = {
  anchor: 'anchor',
  center: 'center',
  intersection: 'intersection',
  tangent: 'tangent',
  perpendicular: 'perpendicular',
  midpoint: 'midpoint',
  extremum: 'extremum',
  quadrant: 'quadrant',
  nearest: 'on path',
};

/** The glyph for `kind` centered on (x, y), `r` from center to edge, as SVG path data. */
export function pathSnapGlyph(kind: PathSnapKind, x: number, y: number, r: number): string {
  const L = x - r, R = x + r, T = y - r, B = y + r;
  const ring = (cx: number, cy: number, rc: number) => {
    const k = rc * 0.5523;
    return `M${cx} ${cy - rc} C${cx + k} ${cy - rc} ${cx + rc} ${cy - k} ${cx + rc} ${cy}`
      + ` C${cx + rc} ${cy + k} ${cx + k} ${cy + rc} ${cx} ${cy + rc}`
      + ` C${cx - k} ${cy + rc} ${cx - rc} ${cy + k} ${cx - rc} ${cy}`
      + ` C${cx - rc} ${cy - k} ${cx - k} ${cy - rc} ${cx} ${cy - rc} Z`;
  };
  switch (kind) {
    case 'anchor': return `M${L} ${T} H${R} V${B} H${L} Z`;
    case 'center': return `${ring(x, y, r)} M${L} ${y} H${R} M${x} ${T} V${B}`;
    case 'intersection': return `M${L} ${T} L${R} ${B} M${R} ${T} L${L} ${B}`;
    case 'midpoint': return `M${x} ${T} L${R} ${B} L${L} ${B} Z`;
    case 'extremum': return `M${x} ${T} L${R} ${y} L${x} ${B} L${L} ${y} Z`;
    case 'quadrant': return ring(x, y, r);
    case 'perpendicular': return `M${L} ${T} V${B} H${R} M${L} ${y} H${x} V${B}`;
    case 'nearest': return `M${L} ${T} H${R} L${L} ${B} H${R} Z`;
    case 'tangent': {
      const rc = (3 * r) / 4;
      return `${ring(x, y + r / 4, rc)} M${L} ${y + r / 4 - rc} H${R}`;
    }
  }
}
