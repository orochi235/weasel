import type { DrawCommand } from '@weasel-js/core/renderer';

/** One px each way round, the eight directions a halo is drawn out to. */
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * The edge `paint` gets drawn in `halo`: what it draws, eight times a px off each way, so the same drawn in place over
 * it reads over whatever the canvas shows behind. For small text, which a renderer stroke skips.
 */
export function haloOf(paint: (dx: number, dy: number, color: string) => DrawCommand[], halo: string): DrawCommand[] {
  return AROUND.flatMap(([dx, dy]) => paint(dx, dy, halo));
}
