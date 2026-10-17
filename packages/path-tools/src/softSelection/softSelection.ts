/**
 * Soft selection: dragging anchors in path edit also moves the anchors near
 * them, each by a falloff of its distance along the path. The reach is drawn
 * as a band while the drag lasts, and the wheel scrubs the radius mid-drag.
 */
import type { OngoingOverlay } from '@weasel-js/routing';
import {
  measureAnchorPath, softSelectionBand, softSelectionWeights, type AnchorSet, type SoftFalloff,
} from '@weasel-js/geom';
import type { PathEditDrag, PathEditDragStart, PathEditExtension } from '@weasel-js/core';

/** How far soft selection reaches, and how it fades. */
export interface SoftSelectionOptions {
  /** How far along the path the influence reaches, in screen pixels. */
  radiusPx: number;
  /** How the influence fades over the radius. Default `'smooth'`. */
  falloff?: SoftFalloff;
  /** Told each radius the wheel scrubs to, so a host can keep it for the next drag. */
  onRadius?: (radiusPx: number) => void;
}

const MIN_RADIUS_PX = 2;
const MAX_RADIUS_PX = 4000;
/** Radius growth per pixel of wheel travel: a notch of about 100 scales it by ~1.16. */
const WHEEL_GAIN = 0.0015;

/** Soft selection as a path-edit extension. `options` is read as each anchor
 *  drag starts; null or undefined leaves that drag hard. */
export function createSoftSelectionExtension(
  options: () => SoftSelectionOptions | null | undefined,
): PathEditExtension {
  return {
    id: 'softSelection',
    drag(start) {
      const opts = options();
      if (!opts || start.part !== 'anchor' || start.dragging.length === 0) return null;
      return softDrag(start, opts);
    },
  };
}

function softDrag(start: PathEditDragStart, opts: SoftSelectionOptions): PathEditDrag {
  const measure = measureAnchorPath(start.anchors, start.scale ? { scale: start.scale } : {});
  const falloff = opts.falloff ?? 'smooth';
  let radiusPx = clampRadius(opts.radiusPx);
  let weights = softSelectionWeights(measure, start.dragging, radiusPx, falloff);
  return {
    weights: () => weights,
    wheel({ deltaY }) {
      radiusPx = clampRadius(radiusPx * Math.exp(-deltaY * WHEEL_GAIN));
      weights = softSelectionWeights(measure, start.dragging, radiusPx, falloff);
      opts.onRadius?.(radiusPx);
      return true;
    },
    overlays: (current: AnchorSet): OngoingOverlay[] =>
      softSelectionBand(measure, current, start.dragging, radiusPx)
        .map((points) => ({ kind: 'polyline', points, role: 'falloff' })),
  };
}

function clampRadius(px: number): number {
  return Math.min(MAX_RADIUS_PX, Math.max(MIN_RADIUS_PX, Number.isFinite(px) ? px : MIN_RADIUS_PX));
}
