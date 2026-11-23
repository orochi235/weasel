import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { ellipsePath, polylineFromPoints } from '@weasel-js/geom';
import { solidFill } from '@weasel-js/paint';
import type { IconSpec } from '@weasel-js/icons';
import type { ResolvedTheme } from '@weasel-js/theme';
import { iconCommands, type GlyphSource } from '../glyph';
import { lensTone } from './lensTone';
import { BAND } from './rimTracks';

type Point = { x: number; y: number };

export const PIN_ICON_PX = 14;
/** Radius of the open circle marking a pin's target. */
export const PIN_TARGET_R = 8;
/** Px from the dock's center a press or a leader reaches. */
export const PIN_DOCK_REACH = BAND / 2 + 2;
const DASH = [3, 3];
/** Where the pin glyph's point is, as a fraction of its frame: the tip of `ui:pin`'s needle. */
const TIP = { x: 0.5, y: 0.83 };

/** Where the pin's icon, and the registry it is drawn from; without both a plain needle is drawn. */
export interface PinGlyph { icons?: GlyphSource; icon?: IconSpec }

/** The pin, its point at `tip`. */
export function pinNeedle(glyph: PinGlyph, tip: Point, color: string): DrawCommand[] {
  const at = { x: tip.x - PIN_ICON_PX * TIP.x, y: tip.y - PIN_ICON_PX * TIP.y, size: PIN_ICON_PX, color };
  const drawn = glyph.icons && glyph.icon ? iconCommands(glyph.icons, glyph.icon, at) : [];
  if (drawn.length > 0) return drawn;
  return [
    { kind: 'path', path: polylineFromPoints([tip, { x: tip.x, y: tip.y - 9 }]), stroke: { paint: { kind: 'solid', color }, width: 1.5 } },
    { kind: 'path', path: ellipsePath({ x: tip.x - 3, y: tip.y - 14, width: 6, height: 6 }), fill: solidFill(color) },
  ];
}

/** A dashed path edged in the surface color, so it reads over whatever the canvas shows. */
function dashedPath(t: ResolvedTheme, path: PathDrawCommand['path']): DrawCommand[] {
  return [
    { kind: 'path', path, stroke: { paint: { kind: 'solid', color: lensTone(t, '--wzl-surface') }, width: 3 } },
    { kind: 'path', path, stroke: { paint: { kind: 'solid', color: lensTone(t, '--wzl-fg') }, width: 1, dash: DASH } },
  ];
}

/** A pin's target, an open dashed circle at `target`, and a dashed leader to it from the dock at `from`. */
export function pinLeader(t: ResolvedTheme, from: Point, target: Point): DrawCommand[] {
  const r = PIN_TARGET_R;
  const out: DrawCommand[] = [];
  const d = Math.hypot(target.x - from.x, target.y - from.y);
  if (d > PIN_DOCK_REACH + r) {
    const u = { x: (target.x - from.x) / d, y: (target.y - from.y) / d };
    out.push(...dashedPath(t, polylineFromPoints([
      { x: from.x + u.x * PIN_DOCK_REACH, y: from.y + u.y * PIN_DOCK_REACH },
      { x: target.x - u.x * r, y: target.y - u.y * r },
    ])));
  }
  out.push(...dashedPath(t, ellipsePath({ x: target.x - r, y: target.y - r, width: r * 2, height: r * 2 })));
  return out;
}

/** The dock on the ring at `c`: a disc, pressed while `on`, holding the pin unless it is carried off, lit while
 *  `lit`. */
export function pinDock(
  t: ResolvedTheme, glyph: PinGlyph, c: Point, state: { on: boolean; hovered: boolean; lit: boolean; holds: boolean },
): DrawCommand[] {
  const fill = state.on ? '--wzl-surface-pressed' : state.hovered ? '--wzl-surface-hover' : '--wzl-surface-raised';
  const out: DrawCommand[] = [{
    kind: 'path', path: ellipsePath({ x: c.x - BAND / 2, y: c.y - BAND / 2, width: BAND, height: BAND }),
    fill: solidFill(lensTone(t, fill)),
    stroke: { paint: { kind: 'solid', color: lensTone(t, '--wzl-border') }, width: 1 },
  }];
  if (state.holds) {
    const tip = { x: c.x, y: c.y + PIN_ICON_PX * (TIP.y - 0.5) };
    out.push(...pinNeedle(glyph, tip, lensTone(t, state.lit ? '--wzl-accent-fg' : '--wzl-fg')));
  }
  return out;
}
