/**
 * The poise lines path edit can draw over the open path: one per curved
 * segment, from its first handle's tip to its second's, with the grip
 * `poiseHandles` drags at the middle, pressed as `poise:N`.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { circlePath, poiseLines, linePath, type AnchorSet, type Point } from '@weasel-js/geom';
import type { PathEditExtension } from '@weasel-js/core';

/** Chrome-caps id the poise lines and their grips are drawn and hit-tested
 *  under. Off by default. */
export const PATH_POISE_CHROME_ID = 'path-edit.poise';

/** How the poise lines are drawn. */
export interface PathEditPoiseStyle {
  /** Color of the line between a segment's handle tips and of its grip's rim. */
  color?: string;
  /** Fill of the grip. */
  gripFill?: string;
  /** Radius of the grip, in screen px. Default 4. */
  gripRadiusPx?: number;
}

const POISE_DEFAULTS: Required<PathEditPoiseStyle> = {
  color: '#9b6bd6',
  gripFill: '#ffffff',
  gripRadiusPx: 4,
};

/** Draw commands for `set`'s poise lines and their grips, in screen space. */
export function poiseCommands(set: AnchorSet, toScreen: (p: Point) => Point, style: PathEditPoiseStyle = {}): DrawCommand[] {
  const { color, gripFill, gripRadiusPx } = { ...POISE_DEFAULTS, ...style };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const line of poiseLines(set)) {
    const grip = toScreen(line.grip);
    out.push({
      kind: 'path',
      path: linePath(toScreen(line.from), toScreen(line.to)),
      stroke: { paint, width: 1 },
    });
    out.push({
      kind: 'path',
      path: circlePath(grip.x, grip.y, gripRadiusPx),
      fill: { paint: { kind: 'solid', color: gripFill } },
      stroke: { paint, width: 1.5 },
    });
  }
  return out;
}

/** The poise lines as a path-edit extension: drawn, and their grips
 *  pressed, while chrome-caps shows {@link PATH_POISE_CHROME_ID}. */
export function createPoiseExtension(style: PathEditPoiseStyle = {}): PathEditExtension {
  return {
    id: 'poise',
    marks: (ctx) => (ctx.isVisible(PATH_POISE_CHROME_ID) ? poiseCommands(ctx.anchors, ctx.toScreen, style) : []),
    parts: (target) => poiseLines(target.anchors).map((line) => ({
      x: line.grip.x,
      y: line.grip.y,
      hitKind: `poise:${line.flat}`,
      chromeId: PATH_POISE_CHROME_ID,
    })),
  };
}
