/**
 * The curvature comb the path-edit overlay can draw over the edited path.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { curvatureComb, linePath, polylineFromPoints, type AnchorSet, type View } from '@weasel-js/geom';

/** Chrome-caps id the overlay draws the curvature comb under. Off by default. */
export const PATH_COMB_CHROME_ID = 'path-edit.comb';

/** How the curvature comb is drawn. */
export interface PathEditCombOptions {
  /** Tooth length per unit of curvature, in world units: a tooth over a
   *  stretch of radius r is `scale / r` long. Default 2000. */
  scale?: number;
  /** Teeth per segment, ends included. Default 24. */
  samplesPerSegment?: number;
  /** Color of the teeth and of the line through their tips. */
  color?: string;
}

const COMB_DEFAULTS = { scale: 2000, samplesPerSegment: 24, color: 'rgba(224, 102, 58, 0.75)' };

function w2s(x: number, y: number, view: View): { x: number; y: number } {
  return { x: (x - view.x) * view.scale.x, y: (y - view.y) * view.scale.y };
}

/** Draw commands for `set`'s curvature comb, in screen space. */
export function combCommands(set: AnchorSet, view: View, opts: PathEditCombOptions = {}): DrawCommand[] {
  const { scale, samplesPerSegment, color } = { ...COMB_DEFAULTS, ...opts };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const { teeth } of curvatureComb(set, { scale, samplesPerSegment })) {
    const tips = teeth.map((t) => w2s(t.tipX, t.tipY, view));
    teeth.forEach((t, i) => {
      out.push({ kind: 'path', path: linePath(w2s(t.x, t.y, view), tips[i]), stroke: { paint, width: 1 } });
    });
    out.push({ kind: 'path', path: polylineFromPoints(tips), stroke: { paint, width: 1.5 } });
  }
  return out;
}
