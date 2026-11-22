import type { WidgetBounds } from '../../widget';
import type { WindowMetrics, WindowZone } from './zones';

const COMPASS: readonly WindowZone[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

/** The resize zone a rim press at `(dx, dy)` from the center pulls: the compass octant it lies in. */
function compassOf(dx: number, dy: number): WindowZone {
  const turn = Math.atan2(dy, dx) / (Math.PI * 2);
  return COMPASS[((Math.round(turn * 8) % 8) + 8) % 8]!;
}

/** How far the interior of a round window sits inside its rim: the resize band, and a passing interior's grip ring. */
export function roundInset(m: WindowMetrics, passing: boolean): number {
  return m.edge + (passing ? m.grip : 0);
}

/**
 * The zone of a round window under `(x, y)`: nothing outside the circle, a resize band around the rim — named for
 * the compass point it pulls, so it takes that cursor — and the interior inside it. A passing interior is ringed by
 * a grip band that moves the window, since the interior cannot.
 */
export function roundZoneAt(
  b: WidgetBounds, m: WindowMetrics, passing: boolean, x: number, y: number,
): WindowZone | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const r = Math.min(b.width, b.height) / 2;
  const dx = x - (b.x + b.width / 2);
  const dy = y - (b.y + b.height / 2);
  const d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d >= r - m.edge) return compassOf(dx, dy);
  if (d >= r - roundInset(m, passing)) return 'title';
  return 'content';
}

/** The interior of a round window: the square its circle of content is inscribed in. */
export function roundContentRect(b: WidgetBounds, m: WindowMetrics, passing: boolean): WidgetBounds {
  const i = roundInset(m, passing);
  return { x: b.x + i, y: b.y + i, width: b.width - i * 2, height: b.height - i * 2 };
}

/**
 * `next`, a drag of `zone` from `start`, made square again: a side pull sets the side and grows the other axis
 * about the center, a corner pull takes the larger extent, and the edge opposite the pull stays put.
 */
export function squareDrag(start: WidgetBounds, next: WidgetBounds, zone: WindowZone): WidgetBounds {
  if (zone === 'title' || zone === 'content' || zone === 'close') return next;
  const side = zone === 'n' || zone === 's' ? next.height
    : zone === 'e' || zone === 'w' ? next.width
      : Math.max(next.width, next.height);
  const x = zone.includes('w') ? start.x + start.width - side
    : zone.includes('e') ? start.x
      : start.x + (start.width - side) / 2;
  const y = zone.includes('n') ? start.y + start.height - side
    : zone.includes('s') ? start.y
      : start.y + (start.height - side) / 2;
  return { x, y, width: side, height: side };
}
