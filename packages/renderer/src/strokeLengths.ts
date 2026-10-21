import type { CommandPaint, MarkerRef, CommandStroke } from '@weasel-js/paint';
import type { PathDrawCommand } from './DrawCommand';
import type { GlMat3 } from '@weasel-js/geom';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import {
  strokeSpaceOf, type ScreenSpace, type StrokeSpaces,
} from '@weasel-js/stroke';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { resolveMarkerSize } from '@weasel-js/stroke';

/** A path command whose stroke paints. */
export type StrokedPathCommand = PathDrawCommand & { stroke: CommandStroke & { paint: CommandPaint } };

/** A stroke command ready to tessellate, and the spaces to tessellate it in. */
export interface ResolvedStrokeCommand {
  cmd: StrokedPathCommand;
  /** Where the ribbon and each head are built; every length in `cmd` is
   *  measured in the space of the part it belongs to. */
  spaces: StrokeSpaces;
}

const WORLD: StrokeSpaces = {};

/**
 * `cmd` with its `{ px }` lengths — the stroke width, any marker size, and on a
 * `{ px }` stroke its dashes — resolved against the accumulated transform's
 * quantized scale (the exact scale with `quantize: false`), so everything downstream (the ribbon cache key, the insets,
 * the heads) sees plain numbers.
 *
 * Under a transform that stretches one direction more than another, each
 * screen-sized part is also built in the transform's stretch, where lengths
 * measure as they do on screen, so it is exact across, down and on every
 * diagonal rather than right only on average. World-sized parts stay in world.
 */
export function resolveStrokeLengths(
  transform: GlMat3,
  cmd: StrokedPathCommand,
  opts: { quantize?: boolean } = {},
): ResolvedStrokeCommand {
  const snap = opts.quantize === false ? (_px: number, scale: number) => scale : quantizeStrokeScale;
  const stroke = cmd.stroke;
  const { markerStart, markerMid, markerEnd } = stroke;
  if (typeof stroke.width !== 'object' && !isPxMarker(markerStart)
    && !isPxMarker(markerMid) && !isPxMarker(markerEnd)) {
    return { cmd, spaces: WORLD };
  }
  const resolved: CommandStroke & { paint: CommandPaint } = { ...stroke };
  const { scale, metric } = strokeSpaceOf(transform[0], transform[1], transform[3], transform[4]);
  const screen = (pxPerUnit: number): ScreenSpace | undefined =>
    metric === null ? undefined : { metric, pxPerUnit };
  let ribbon: ScreenSpace | undefined;
  if (typeof stroke.width === 'object') {
    const pxPerUnit = snap(stroke.width.px, scale);
    resolved.width = resolveStrokeWidth(stroke.width, pxPerUnit);
    if (stroke.dash && pxPerUnit > 0) resolved.dash = stroke.dash.map((d) => d / pxPerUnit);
    ribbon = screen(pxPerUnit);
  }
  const head = (ref: MarkerRef | undefined): ScreenSpace | undefined => {
    if (ref === undefined || typeof ref === 'string' || ref.size === undefined) return ribbon;
    if (typeof ref.size === 'number') return undefined;
    return screen(snap(ref.size.px, scale));
  };
  const spaces = { ribbon, start: head(markerStart), mid: head(markerMid), end: head(markerEnd) };
  if (isPxMarker(markerStart)) resolved.markerStart = resolvedMarker(markerStart, scale, snap);
  if (isPxMarker(markerMid)) resolved.markerMid = resolvedMarker(markerMid, scale, snap);
  if (isPxMarker(markerEnd)) resolved.markerEnd = resolvedMarker(markerEnd, scale, snap);
  return { cmd: { ...cmd, stroke: resolved }, spaces };
}

type PxMarker = Exclude<MarkerRef, string> & { size: { px: number } };

function isPxMarker(ref: MarkerRef | undefined): ref is PxMarker {
  return typeof ref === 'object' && typeof ref.size === 'object';
}

function resolvedMarker(ref: PxMarker, scale: number, snap: (px: number, scale: number) => number): MarkerRef {
  return { ...ref, size: resolveMarkerSize(ref, 0, snap(ref.size.px, scale)) };
}
