/**
 * Which way the open path runs, drawn over it: an arrow at the middle of
 * every segment and a ring round each subpath's start anchor.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { circlePath, directionMarks, polygonFromPoints, type AnchorSet, type Point } from '@weasel-js/geom';
import type { PathEditExtension } from '@weasel-js/core';

/** Chrome-caps id the direction arrows and start rings are drawn under. Off by default. */
export const PATH_DIRECTION_CHROME_ID = 'path-edit.direction';

/** How the direction marks are drawn. */
export interface PathDirectionStyle {
  /** Color of the arrows and the start rings. */
  color?: string;
  /** Length of an arrow, tip to base, in screen pixels. */
  arrowPx?: number;
  /** Radius of a start ring, in screen pixels. */
  ringPx?: number;
}

const DIRECTION_DEFAULTS: Required<PathDirectionStyle> = { color: '#e8590c', arrowPx: 9, ringPx: 8 };

/** Draw commands for `set`'s direction arrows and start rings, in screen space. */
export function directionCommands(set: AnchorSet, toScreen: (p: Point) => Point, style: PathDirectionStyle = {}): DrawCommand[] {
  const { color, arrowPx, ringPx } = { ...DIRECTION_DEFAULTS, ...style };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const m of directionMarks(set)) {
    const c = toScreen(m);
    const ahead = toScreen({ x: m.x + m.dx, y: m.y + m.dy });
    const k = Math.hypot(ahead.x - c.x, ahead.y - c.y);
    if (k === 0) continue;
    const ux = (ahead.x - c.x) / k, uy = (ahead.y - c.y) / k;
    const tip = { x: c.x + (ux * arrowPx) / 2, y: c.y + (uy * arrowPx) / 2 };
    const back = { x: c.x - (ux * arrowPx) / 2, y: c.y - (uy * arrowPx) / 2 };
    const half = arrowPx * 0.45;
    out.push({
      kind: 'path',
      path: polygonFromPoints([tip, { x: back.x - uy * half, y: back.y + ux * half }, { x: back.x + uy * half, y: back.y - ux * half }]),
      fill: { paint },
    });
  }
  for (const sub of set.anchors) {
    if (sub.length === 0) continue;
    const start = toScreen(sub[0]);
    out.push({ kind: 'path', path: circlePath(start.x, start.y, ringPx), stroke: { paint, width: 2 } });
  }
  return out;
}

/** The direction marks as a path-edit extension, drawn in `style` while
 *  chrome-caps shows {@link PATH_DIRECTION_CHROME_ID}. */
export function createDirectionExtension(style: PathDirectionStyle = {}): PathEditExtension {
  return {
    id: 'pathDirection',
    marks: (ctx) => (ctx.isVisible(PATH_DIRECTION_CHROME_ID) ? directionCommands(ctx.anchors, ctx.toScreen, style) : []),
  };
}
