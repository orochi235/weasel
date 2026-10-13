/**
 * Turning a stroke's markers into draw commands.
 *
 * Separate `PathDrawCommand`s rather than triangles appended to the stroke
 * ribbon: an entry may carry a fill and an outline at once, or a paint that
 * differs from the line's, neither of which one mesh can express — and folding
 * them in would drag the whole marker vocabulary into the ribbon cache key.
 */

import type { CommandPaint, CommandStroke } from '@weasel-js/paint';
import { type Path, type PolygonPath, boundsOfPath } from '@weasel-js/geom';
import { markerHeads, type MarkerHead, type MarkerPaint } from '@weasel-js/stroke';
import type { PathDrawCommand } from './DrawCommand';
import { commandPaint } from './patterns/commandPaint';

/** A marker's own paint is resolved against its head's box, as a node's is
 *  against the node's. */
function resolvePaint(
  p: MarkerPaint | undefined, stroke: CommandStroke, fallback: MarkerPaint, head: PolygonPath,
): CommandPaint | undefined {
  const v = p ?? fallback;
  if (v === 'none') return undefined;
  if (v === 'line') return stroke.paint;
  return commandPaint(v, boundsOfPath(head)) ?? undefined;
}

/** `heads` as draw commands in `stroke`'s paint. A head whose fill and outline
 *  both resolve to no paint is dropped. */
export function headCommands(heads: readonly MarkerHead[], stroke: CommandStroke): PathDrawCommand[] {
  const out: PathDrawCommand[] = [];
  for (const { entry, path, size, space } of heads) {
    const fill = resolvePaint(entry.fill, stroke, 'line', path);
    // A head built in a screen space is in world once placed, but its outline
    // width is still in that space's units — so it goes out as the screen
    // width it stands for, and is stroked as exactly as the line.
    const width = entry.outline ? entry.outline.width * size : 0;
    const outline = entry.outline
      ? { paint: resolvePaint(entry.outline.paint, stroke, 'line', path), width: space ? { px: width * space.pxPerUnit } : width }
      : null;
    if (fill === undefined && (outline === null || outline.paint === undefined)) continue;
    out.push({
      kind: 'path',
      path,
      ...(fill ? { fill: { paint: fill } } : {}),
      ...(outline && outline.paint
        ? { stroke: { paint: outline.paint, width: outline.width, cap: 'round', join: 'round' } }
        : {}),
    });
  }
  return out;
}

/** Every marker command for `path` under `stroke`; see `markerHeads`. */
export function markerDrawCommands(
  path: Path,
  stroke: CommandStroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
): PathDrawCommand[] {
  return headCommands(markerHeads(path, stroke, strokeWidth, flattenTolerance), stroke);
}
