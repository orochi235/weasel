/**
 * A stroke's start and end heads seated as the kit seats them: the shaft cut
 * back by each head's inset, and the head's back on the cut end, pointing
 * along the shaft there. SVG points a marker along the path at its end, so a
 * shaft cut back and a marker whose reference point is moved back by the same
 * inset ({@link ./markerDefs}) draw exactly that.
 */

import { markerInset, type Path } from '@weasel-js/core';
import { splitByClosure, splitSubpaths } from '@weasel-js/geom';
import { insetPath } from '@weasel-js/stroke';
import { drawsAsGroup } from './openSubpathFill';
import { seats } from './markerDefs';
import { writesOutline } from './strokeOutlineSvg';
import type { SvgGroupNode, SvgPathNode, SvgStroke } from './types';

/** Which ends of a path element were cut back for a seated head, and the path as authored. */
export interface Seat {
  start: boolean;
  end: boolean;
  authored: Path;
}

/** A path element whose shaft was cut back; only the serializer makes one. */
export type SeatedPathNode = SvgPathNode & { seat?: Seat };

const NONE = { kind: 'none' } as const;

/** How far the line stops short of a start or end head that seats. */
function insetOf(ref: SvgStroke['markerStart'], width: number): number {
  return ref === undefined || !seats(ref) ? 0 : markerInset(ref, width);
}

/** `path` cut back for `stroke`'s seated heads, or `null` when it seats none:
 *  no head that seats, a path that is not one open subpath, or insets that
 *  eat the whole line. */
function cutShaft(path: Path, stroke: SvgStroke): { path: Path; start: boolean; end: boolean } | null {
  if (path.kind !== 'polygon' || writesOutline(stroke)) return null;
  const width = typeof stroke.width === 'number' ? stroke.width : stroke.width?.px ?? 1;
  const start = insetOf(stroke.markerStart, width);
  const end = insetOf(stroke.markerEnd, width);
  if (!(start > 0) && !(end > 0)) return null;
  if (splitSubpaths(path).length !== 1 || splitByClosure(path).closed !== null) return null;
  const cut = insetPath(path, start, end);
  return cut && { path: cut, start: start > 0, end: end > 0 };
}

/**
 * `drawn`, one element as SVG draws a path node, with its stroke cut back for
 * the heads that seat. A cut element that also fills splits into the fill,
 * whole, and the cut stroke over it. One already cut is returned as it is.
 */
export function withSeatedHeads(drawn: SeatedPathNode): SeatedPathNode | SvgGroupNode {
  if (drawn.seat) return drawn;
  const cut = drawn.stroke && cutShaft(drawn.path, drawn.stroke);
  if (!cut) return drawn;
  const seat: Seat = { start: cut.start, end: cut.end, authored: drawn.path };
  if (drawn.fill.kind === 'none') return { ...drawn, path: cut.path, seat };
  const { stroke, ...fillOnly } = drawn;
  const shaft: SeatedPathNode = { kind: 'path', path: cut.path, fill: NONE, stroke, seat };
  return drawsAsGroup(drawn, [{ kind: 'path', path: fillOnly.path, fill: fillOnly.fill }, shaft]);
}
