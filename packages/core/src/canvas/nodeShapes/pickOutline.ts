/**
 * Whether one painted outline covers a world point: its fill, and its
 * stroke's reach, over only the stretch a trim draws.
 */
import {
  asPolygonPath, pathContainsPoint, pathThroughPoseFrame, poseFrameOf, strokeHitTest,
  type LengthSpan, type Path,
} from '@weasel-js/geom';
import type { StrokeTrim } from '@weasel-js/paint';
import { spanOnPath, trimSpan } from '@weasel-js/stroke';
import { hasSlop, slopForStrokeHit, widenSlop, type PickSlop } from 'core/viewport/screenSlop';
import type { NodeInk } from '../nodeShapeTypes';

/** A trimmed stroke's outline in world, and the stretch of it that is drawn; `span` null draws nothing. */
export interface TrimmedOutline {
  drawn: Path;
  span: LengthSpan | null;
}

/** What a pick reads besides the point. */
export interface PickReach {
  tolerance?: PickSlop;
  scale?: number;
}

/**
 * Where `trim` draws along `local`, the outline as the painter strokes it, once
 * the pose frame carries it to `world`. The ribbon measures before the frame,
 * so the span is measured on `local` and restated on the world outline.
 */
export function trimmedOutline(local: Path, world: Path, pose: unknown, trim: StrokeTrim): TrimmedOutline {
  // A rect goes through as a polygon: a mirrored rect would come out restarted.
  const drawn = poseFrameOf(pose) === null ? world : pathThroughPoseFrame(asPolygonPath(local), pose);
  const span = trimSpan(local, trim);
  return { drawn, span: span && spanOnPath(span, local, drawn) };
}

/**
 * Does the outline `fill` (world), inked as `ink`, cover (x, y)? The stroke
 * reaches a different distance on each side, so which side the point is on
 * picks the reach; `tolerance` also makes a filled shape grabbable a few
 * pixels outside its edge. `trimmed` limits the stroke's reach to its span.
 */
export function inkCovers(
  fill: Path, ink: NodeInk, trimmed: TrimmedOutline | undefined, x: number, y: number, opts: PickReach,
): boolean {
  const inside = pathContainsPoint(fill, x, y);
  if (ink.filled && inside) return true;
  const slop = widenSlop(opts.tolerance, (inside ? ink.insetPx : ink.outsetPx) ?? 0, opts.scale);
  const reach = inside ? ink.inset : ink.outset;
  if (trimmed === undefined) return outlineWithin(fill, x, y, reach, slop);
  if (trimmed.span && outlineWithin(trimmed.drawn, x, y, reach, slop, trimmed.span)) return true;
  // A fill's edge is grabbable by the tolerance alone, all the way round.
  return ink.filled && outlineWithin(fill, x, y, 0, opts.tolerance);
}

function outlineWithin(
  path: Path, x: number, y: number, reach: number, slop: PickSlop | undefined, span?: LengthSpan,
): boolean {
  const { extra, opts: hit } = slopForStrokeHit(slop);
  const r = reach + extra;
  return (r > 0 || hasSlop(slop)) && strokeHitTest(path, x, y, r, span ? { ...hit, span } : hit);
}
