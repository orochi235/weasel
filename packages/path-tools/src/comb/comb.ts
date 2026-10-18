/**
 * The curvature comb path edit can draw over the open path.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { curvatureComb, linePath, polylineFromPoints, type AnchorSet, type Point } from '@weasel-js/geom';
import type { PathEditExtension } from '@weasel-js/core';

/** Chrome-caps id the curvature comb is drawn under. Off by default. */
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

/** Draw commands for `set`'s curvature comb, in screen space. */
export function combCommands(set: AnchorSet, toScreen: (p: Point) => Point, opts: PathEditCombOptions = {}): DrawCommand[] {
  const { scale, samplesPerSegment, color } = { ...COMB_DEFAULTS, ...opts };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const { teeth } of curvatureComb(set, { scale, samplesPerSegment })) {
    const tips = teeth.map((t) => toScreen({ x: t.tipX, y: t.tipY }));
    teeth.forEach((t, i) => {
      out.push({ kind: 'path', path: linePath(toScreen(t), tips[i]), stroke: { paint, width: 1 } });
    });
    out.push({ kind: 'path', path: polylineFromPoints(tips), stroke: { paint, width: 1.5 } });
  }
  return out;
}

/** The comb as a path-edit extension, drawn while chrome-caps shows
 *  {@link PATH_COMB_CHROME_ID}. `options` is read every frame. */
export function createCombExtension(options: () => PathEditCombOptions | undefined = () => undefined): PathEditExtension {
  return {
    id: 'curvatureComb',
    marks: (ctx) => (ctx.isVisible(PATH_COMB_CHROME_ID) ? combCommands(ctx.anchors, ctx.toScreen, options()) : []),
  };
}
