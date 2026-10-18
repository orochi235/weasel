/**
 * The balance lines path edit can draw over the open path: one per curved
 * segment, from its first handle's tip to its second's, with the grip
 * `balanceHandles` drags at the middle, pressed as `balance:N`.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { circlePath, handleBalances, linePath, type AnchorSet, type Point } from '@weasel-js/geom';
import type { PathEditExtension } from '@weasel-js/core';

/** Chrome-caps id the balance lines and their grips are drawn and hit-tested
 *  under. Off by default. */
export const PATH_BALANCE_CHROME_ID = 'path-edit.balance';

/** How the balance lines are drawn. */
export interface PathEditBalanceStyle {
  /** Color of the line between a segment's handle tips and of its grip's rim. */
  color?: string;
  /** Fill of the grip. */
  gripFill?: string;
  /** Radius of the grip, in screen px. Default 4. */
  gripRadiusPx?: number;
}

const BALANCE_DEFAULTS: Required<PathEditBalanceStyle> = {
  color: '#9b6bd6',
  gripFill: '#ffffff',
  gripRadiusPx: 4,
};

/** Draw commands for `set`'s balance lines and their grips, in screen space. */
export function balanceCommands(set: AnchorSet, toScreen: (p: Point) => Point, style: PathEditBalanceStyle = {}): DrawCommand[] {
  const { color, gripFill, gripRadiusPx } = { ...BALANCE_DEFAULTS, ...style };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const line of handleBalances(set)) {
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

/** The balance lines as a path-edit extension: drawn, and their grips
 *  pressed, while chrome-caps shows {@link PATH_BALANCE_CHROME_ID}. */
export function createBalanceExtension(style: PathEditBalanceStyle = {}): PathEditExtension {
  return {
    id: 'balance',
    marks: (ctx) => (ctx.isVisible(PATH_BALANCE_CHROME_ID) ? balanceCommands(ctx.anchors, ctx.toScreen, style) : []),
    parts: (target) => handleBalances(target.anchors).map((line) => ({
      x: line.grip.x,
      y: line.grip.y,
      hitKind: `balance:${line.flat}`,
      chromeId: PATH_BALANCE_CHROME_ID,
    })),
  };
}
