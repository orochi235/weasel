/**
 * The marker for a path snap: a glyph for the kind of target the point locked
 * to, drawn on it, and the kind's name beside it.
 */
import { pathFromD, type PathSnapKind } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { textCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { PathSnapper } from './pathSnapper';

/** What the marker calls each kind of target. */
export const PATH_SNAP_LABELS: Readonly<Record<PathSnapKind, string>> = {
  intersection: 'intersection',
  tangent: 'tangent',
  perpendicular: 'perpendicular',
  midpoint: 'midpoint',
  extremum: 'extremum',
  quadrant: 'quadrant',
  nearest: 'on path',
};

/** Style for {@link createPathSnapMarkerLayer}. */
export interface PathSnapMarkerStyle {
  /** Glyph and label color. */
  color?: string;
  /** Half the glyph's width, in screen pixels. */
  size?: number;
  /** Label size, in screen pixels. */
  fontSize?: number;
}

/** The glyph for `kind` centered on (x, y), `r` from center to edge, as SVG path data. */
export function pathSnapGlyph(kind: PathSnapKind, x: number, y: number, r: number): string {
  const L = x - r, R = x + r, T = y - r, B = y + r;
  switch (kind) {
    case 'intersection': return `M${L} ${T} L${R} ${B} M${R} ${T} L${L} ${B}`;
    case 'midpoint': return `M${x} ${T} L${R} ${B} L${L} ${B} Z`;
    case 'extremum': return `M${x} ${T} L${R} ${y} L${x} ${B} L${L} ${y} Z`;
    case 'quadrant': return `M${L} ${T} H${R} V${B} H${L} Z`;
    case 'perpendicular': return `M${L} ${T} V${B} H${R} M${L} ${y} H${x} V${B}`;
    case 'nearest': return `M${L} ${T} H${R} L${L} ${B} H${R} Z`;
    case 'tangent': {
      const cy = y + r / 4, rc = (3 * r) / 4, k = rc * 0.5523;
      const top = cy - rc;
      return `M${x} ${top} C${x + k} ${top} ${x + rc} ${cy - k} ${x + rc} ${cy}`
        + ` C${x + rc} ${cy + k} ${x + k} ${cy + rc} ${x} ${cy + rc}`
        + ` C${x - k} ${cy + rc} ${x - rc} ${cy + k} ${x - rc} ${cy}`
        + ` C${x - rc} ${cy - k} ${x - k} ${top} ${x} ${top} Z M${L} ${top} H${R}`;
    }
  }
}

/**
 * A screen-space layer drawing `snapper`'s current mark: the kind's glyph on
 * the snapped point and its label above and to the right. Draws nothing while
 * there is no mark or the snapper's `marker` option is off, and repaints
 * whenever the mark changes.
 */
export function createPathSnapMarkerLayer(
  snapper: PathSnapper,
  style: PathSnapMarkerStyle = {},
): RenderLayer<unknown> {
  const color = style.color ?? '#e8742c';
  const r = style.size ?? 5;
  const fontSize = style.fontSize ?? 11;
  return {
    id: 'path-snap-marker',
    label: 'Path snap marker',
    space: 'screen',
    alwaysOn: true,
    subscribe: (repaint) => snapper.subscribe(repaint),
    draw: (_data, view) => {
      const m = snapper.mark();
      if (!m || !snapper.showsMarker()) return [];
      const [sx, sy] = worldToScreen(m.x, m.y, viewToTransform(view));
      const out: DrawCommand[] = [
        { kind: 'path', path: pathFromD(pathSnapGlyph(m.kind, sx, sy, r)), stroke: { paint: { color }, width: 1.5 } },
        textCommand(sx + r + 3, sy - r - fontSize - 2, PATH_SNAP_LABELS[m.kind], { fontSize }, undefined, undefined, undefined, {
          fill: { paint: { color } },
        }),
      ];
      return out;
    },
  };
}
