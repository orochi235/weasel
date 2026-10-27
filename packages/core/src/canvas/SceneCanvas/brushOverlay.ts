import type { PathDrawCommand } from '@weasel-js/renderer';
import { circlePath, polylineFromPoints, type Point } from '@weasel-js/geom';

/** The colors a brush overlay paints with: `fill` for the area swept, `stroke`
 *  for the footprint's rim. */
export interface BrushOverlayStyle {
  fill: string;
  stroke: string;
  lineWidth: number;
}

/**
 * A `brush` overlay as screen-space commands: the area swept so far, and the
 * brush's rim where it is now. `points` are already on screen.
 */
export function brushOverlayCommands(
  points: readonly Point[],
  radiusPx: number,
  style: BrushOverlayStyle,
): PathDrawCommand[] {
  const head = points[points.length - 1];
  if (!head) return [];
  const swept: PathDrawCommand = points.length === 1
    ? { kind: 'path', path: circlePath(head.x, head.y, radiusPx), fill: { paint: { color: style.fill } } }
    : {
        kind: 'path',
        path: polylineFromPoints(points),
        stroke: { paint: { color: style.fill }, width: radiusPx * 2, cap: 'round', join: 'round' },
      };
  return [
    swept,
    {
      kind: 'path',
      path: circlePath(head.x, head.y, radiusPx),
      stroke: { paint: { color: style.stroke }, width: style.lineWidth },
    },
  ];
}
