import type { WidgetBounds } from '../../widget';

/** What part of a window a point falls in — which decides what a drag
 *  starting there does and which cursor to show. */
export type WindowZone =
  | 'title' | 'close' | 'content'
  | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The window frame's fixed dimensions. Override per window to make the grab
 *  zones larger, or the chrome smaller. */
export interface WindowMetrics {
  /** Titlebar height in CSS px. */
  titleH: number;
  /** Grab-zone thickness on each side, and the frame inset, in CSS px. */
  edge: number;
  /** Side length of the square close box. */
  closeSize: number;
}

/** Frame dimensions a window uses unless its options override them. */
export const DEFAULT_WINDOW_METRICS: WindowMetrics = { titleH: 24, edge: 6, closeSize: 14 };

/** The eight resize zones a drag can start in, plus title/close/content. */
export function zoneAt(
  b: WidgetBounds,
  m: WindowMetrics,
  x: number,
  y: number,
): WindowZone | null {
  if (x < b.x || x >= b.x + b.w || y < b.y || y >= b.y + b.h) return null;

  const west  = x < b.x + m.edge;
  const east  = x >= b.x + b.w - m.edge;
  const north = y < b.y + m.edge;
  const south = y >= b.y + b.h - m.edge;

  if (north && west) return 'nw';
  if (north && east) return 'ne';
  if (south && west) return 'sw';
  if (south && east) return 'se';
  if (north) return 'n';
  if (south) return 's';
  if (west) return 'w';
  if (east) return 'e';

  if (y < b.y + m.titleH) {
    const cx = b.x + b.w - m.edge - m.closeSize;
    return x >= cx ? 'close' : 'title';
  }
  return 'content';
}

/** Interior rect: below the titlebar, inside the frame on the other three sides. */
export function windowContentRect(b: WidgetBounds, m: WindowMetrics): WidgetBounds {
  return {
    x: b.x + m.edge,
    y: b.y + m.titleH,
    w: b.w - m.edge * 2,
    h: b.h - m.titleH - m.edge,
  };
}

/**
 * Bounds after dragging `zone` by `(dx, dy)` from `start`. West/north
 * clamping holds the opposite edge; clamping the extent alone would walk the
 * window sideways once it bottoms out.
 */
export function applyWindowDrag(
  start: WidgetBounds,
  zone: WindowZone,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
): WidgetBounds {
  if (zone === 'title') return { ...start, x: start.x + dx, y: start.y + dy };
  if (zone === 'content' || zone === 'close') return { ...start };

  let { x, y, w, h } = start;
  const right = start.x + start.w;
  const bottom = start.y + start.h;

  if (zone === 'w' || zone === 'nw' || zone === 'sw') {
    w = Math.max(minW, start.w - dx);
    x = right - w;
  } else if (zone === 'e' || zone === 'ne' || zone === 'se') {
    w = Math.max(minW, start.w + dx);
  }

  if (zone === 'n' || zone === 'nw' || zone === 'ne') {
    h = Math.max(minH, start.h - dy);
    y = bottom - h;
  } else if (zone === 's' || zone === 'sw' || zone === 'se') {
    h = Math.max(minH, start.h + dy);
  }

  return { x, y, w, h };
}

/** CSS cursor for a zone, for the host to apply on hover. */
export function cursorForZone(zone: WindowZone): string {
  switch (zone) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'nw': case 'se': return 'nwse-resize';
    case 'title': return 'move';
    default: return 'default';
  }
}
