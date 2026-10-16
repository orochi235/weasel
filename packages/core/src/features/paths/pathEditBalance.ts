/**
 * The balance lines the path-edit overlay can draw over the edited path: one
 * per curved segment, from its first handle's tip to its second's, with the
 * grip `balanceHandles` drags at the middle.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import { circlePath, handleBalances, linePath, type AnchorSet, type View } from '@weasel-js/geom';
import { worldToScreen } from './anchorMarkers';

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
export function balanceCommands(set: AnchorSet, view: View, style: PathEditBalanceStyle = {}): DrawCommand[] {
  const { color, gripFill, gripRadiusPx } = { ...BALANCE_DEFAULTS, ...style };
  const paint = { kind: 'solid' as const, color };
  const out: DrawCommand[] = [];
  for (const line of handleBalances(set)) {
    const grip = worldToScreen(line.grip, view);
    out.push({
      kind: 'path',
      path: linePath(worldToScreen(line.from, view), worldToScreen(line.to, view)),
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
