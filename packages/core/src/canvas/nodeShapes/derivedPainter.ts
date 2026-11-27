import { boundsOfPath, pathThroughPoseFrame, poseFrameOf, type Affine, type Path } from '@weasel-js/geom';
import type { Stroke, Fill, Inherit } from '@weasel-js/paint';
import type { NodeInk, NodeInkCtx, NodeShapeEntry } from 'canvas/NodeShape';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { unionBounds } from 'core/geometry/unionBounds';
import type { DrawCommand } from '@weasel-js/renderer';
import { derivedPartsOf, resolvePartPaint, type DerivedPart } from 'core/scene/derivedParts';
import { derivesPath } from './memo';
import type { InheritedPaint } from 'core/scene/inheritedPaint';
import { strokedPathBounds } from './strokedBounds';
import { inkCovers, trimmedOutline, type PickReach, type TrimmedOutline } from './pickOutline';
import { inkReach, inkStroke, pathCommand, withAnimatedStrokeTrim, withAnimatedTrim, withAnimatedVertexColors } from './nodePaint';
import {
  INHERIT, resolveFill, resolveStroke, strokeTrimKey,
} from '@weasel-js/paint';

/** A derived part's path framed by one pose frame, and its trimmed outline under one trim. */
interface FramedPart {
  frame: Affine;
  world: Path;
  trimKey?: string;
  trimmed?: TrimmedOutline;
}

// Kept per part path, which is immutable, so the length tables and corners built on the framed
// outline are reused across picks; a new frame or trim replaces the entry. Keyed on the frame's values, not
// the pose object: a per-frame override rewrites one pose buffer in place.
const FRAMED = new WeakMap<Path, FramedPart>();

function framedPart(path: Path, pose: unknown, frame: Affine): FramedPart {
  const hit = FRAMED.get(path);
  if (hit && hit.frame.every((v, i) => v === frame[i])) return hit;
  const made: FramedPart = { frame, world: pathThroughPoseFrame(path, pose) };
  FRAMED.set(path, made);
  return made;
}

/** Test seam: the trimmed outline kept for `path`'s part, if any. */
export function _framedPartOutlineForTests(path: Path): TrimmedOutline | undefined {
  return FRAMED.get(path)?.trimmed;
}

type PaintData = { fill?: Fill | Inherit | null; stroke?: Stroke | Inherit | null; vertexColors?: number[] };

/** The box the path on `ctx` paints, each of its parts in its own fill and stroke, or `null` with no path or
 *  no paint. A painted outline's own box is kept under its stroke's: a trim, a dash or an inner stroke draws
 *  less than the outline. */
export function derivedDrawnBounds(node: { data?: unknown }, ctx: NodeInkCtx | undefined): Bounds | null {
  const path = ctx?.derivedPath;
  if (path == null) return null;
  const d = node.data as PaintData | null;
  const painted = (p: Path, fill: Fill | null, stroke: Stroke | null): Bounds[] => {
    if (fill === null && stroke === null) return [];
    const stroked = stroke === null ? null : strokedPathBounds(p, stroke, ctx?.scale ?? 1, ctx?.screen);
    return stroked === null ? [boundsOfPath(p)] : [boundsOfPath(p), stroked];
  };
  const parts = derivedPartsOf(path);
  if (parts === undefined) {
    return unionBounds(painted(path, resolveFill(d?.fill, ctx?.inherited?.fill), resolveStroke(d?.stroke, ctx?.inherited?.stroke)));
  }
  return unionBounds(parts.flatMap((part) => {
    const { fill, stroke } = resolvePartPaint(part, d, ctx?.inherited);
    return painted(part.path, fill, stroke);
  }));
}

/** One part's command, in its own paint; `INHERIT` takes the node's. */
function partCommand(part: DerivedPart, d: PaintData | null, inherited: InheritedPaint | undefined): DrawCommand {
  const { fill, stroke } = resolvePartPaint(part, d, inherited);
  return pathCommand(part.path, fill, stroke, undefined);
}

/**
 * Built-in painter for nodes whose geometry is computed from other nodes'
 * poses. The path itself arrives on the paint context — see
 * {@link NodePaintCtx.derivedPath}.
 *
 * Fill and stroke resolve as `kit:path`'s do, but against the **derived path's
 * own bounds**, not the pose. `kit:path` projects its path into the pose frame
 * first, so there the two boxes are the same one; here the path is already
 * absolute and the pose is typically a zero-sized placeholder, which would
 * collapse a box-relative gradient onto a point.
 *
 * Not memoized on {@link PAINT_SLOT} on purpose: that key is `(node, pose,
 * data)` and cannot see `ctx.derivedPath`, so it would serve one caller's
 * commands to a caller that passed a different path.
 *
 * Rotation still comes from the pose — `wrapNodeOutput` turns the output about
 * the pose AABB's center, which for a zero-sized pose is its origin.
 *
 * A path made by `pathFromParts` paints one command per part, each in the
 * part's own fill and stroke; an animated trim reaches only the parts stroked
 * `INHERIT`, which draw the node's own stroke.
 */
export const DERIVED_PAINTER: NodeShapeEntry = {
  id: 'kit:derived',
  // `dependsOn` alone is not enough: the two fields are independent optionals,
  // and `kit:add` restores a node with its `dependsOn` intact when its
  // `derivePath` key is missing from the registry. Claiming that node would paint
  // nothing where the authored appearance is what the warning promises.
  matches: derivesPath,
  paint: (node, _pose, ctx) => {
    const path = ctx?.derivedPath;
    if (path == null) return [];
    const d = node.data as PaintData | null;
    const parts = derivedPartsOf(path);
    if (parts !== undefined) {
      return parts.map((part) => {
        const cmd = partCommand(part, d, ctx?.inherited);
        return part.stroke === INHERIT ? withAnimatedStrokeTrim(cmd, ctx) : cmd;
      });
    }
    const strokeSpec = resolveStroke(d?.stroke, ctx?.inherited?.stroke);
    const declared = resolveFill(d?.fill, ctx?.inherited?.fill);
    return withAnimatedTrim(withAnimatedVertexColors([pathCommand(path, declared, strokeSpec, d?.vertexColors)], ctx), ctx);
  },
  // The derived path *is* the silhouette, and it is already absolute — the
  // pose is a placeholder, so nothing here can be recovered from it. Without
  // a `ctx` this reports null, which `shapeCoversPoint` reads as "no
  // opinion": picking then falls back to that zero-sized pose.
  silhouette: (_node, _pose, ctx) => ctx?.derivedPath ?? null,
  drawnBounds: (node, _pose, ctx) => derivedDrawnBounds(node, ctx),
  ink: (node, _pose, ctx) => {
    const d = node.data as PaintData | null;
    const parts = derivedPartsOf(ctx?.derivedPath);
    if (parts !== undefined) return partsInk(parts, d, ctx);
    const stroke = resolveStroke(d?.stroke, ctx?.inherited?.stroke);
    return {
      filled: resolveFill(d?.fill, ctx?.inherited?.fill) !== null,
      ...inkReach(stroke, ctx?.scale),
      ...inkStroke(stroke),
    };
  },
};

/** The ink of a path drawn in `parts`, each in its own paint: filled if any part is, and reaching as far as
 *  the farthest part's stroke on each side. It names no stroke, since no one stroke runs along the whole path. */
function partsInk(parts: readonly DerivedPart[], d: PaintData | null, ctx: NodeInkCtx | undefined): NodeInk {
  const ink: NodeInk = { filled: false, outset: 0, inset: 0 };
  for (const part of parts) {
    const { fill, stroke } = resolvePartPaint(part, d, ctx?.inherited);
    const r = inkReach(stroke, ctx?.scale);
    ink.filled ||= fill !== null;
    ink.outset = Math.max(ink.outset, r.outset);
    ink.inset = Math.max(ink.inset, r.inset);
    if (r.outsetPx !== undefined) ink.outsetPx = Math.max(ink.outsetPx ?? 0, r.outsetPx);
    if (r.insetPx !== undefined) ink.insetPx = Math.max(ink.insetPx ?? 0, r.insetPx);
  }
  return ink;
}

/**
 * Whether a derived path in `parts` covers the world point (x, y): each part
 * picked as {@link DERIVED_PAINTER} paints it, in its own fill and stroke,
 * a trim cutting each part along its own length.
 */
export function partsCover(
  node: { data?: unknown }, parts: readonly DerivedPart[], pose: unknown, x: number, y: number,
  opts: PickReach & { inherited?: InheritedPaint },
): boolean {
  const d = node.data as PaintData | null;
  const frame = poseFrameOf(pose);
  return parts.some((part) => {
    const { fill, stroke } = resolvePartPaint(part, d, opts.inherited);
    const framing = frame ? framedPart(part.path, pose, frame) : null;
    const world = framing?.world ?? part.path;
    const ink = { filled: fill !== null, ...inkReach(stroke, opts.scale) };
    const trim = stroke?.trim;
    let trimmed: TrimmedOutline | undefined;
    if (trim !== undefined) {
      const key = strokeTrimKey(trim);
      if (framing && framing.trimKey === key && framing.trimmed) trimmed = framing.trimmed;
      else {
        trimmed = trimmedOutline(part.path, world, pose, trim);
        if (framing) Object.assign(framing, { trimKey: key, trimmed });
      }
    }
    return inkCovers(world, ink, trimmed, x, y, opts);
  });
}
