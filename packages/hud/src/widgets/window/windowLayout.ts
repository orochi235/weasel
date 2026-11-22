import type { WidgetBounds } from '../../widget';
import type { WindowShape } from './windowFrame';
import { DEFAULT_WINDOW_METRICS, type WindowMetrics, type WindowZone, windowContentRect, zoneAt } from './zones';
import { roundContentRect, roundZoneAt, squareDrag } from './roundZones';

/** What a window's layout is read from, once, as it is made. */
export interface WindowLayoutOptions {
  round: boolean;
  titlebar: boolean;
  passing: boolean;
  metrics?: Partial<WindowMetrics>;
  minWidth?: number;
  minHeight?: number;
}

/** A window's fixed geometry: its frame shape, its smallest size, and where in a given box each zone lies. */
export interface WindowLayout {
  shape: WindowShape;
  minW: number;
  minH: number;
  /** `b` grown to the smallest size, and made square for a round window. */
  clampSize(b: WidgetBounds): WidgetBounds;
  zoneAt(b: WidgetBounds, x: number, y: number): WindowZone | null;
  contentRect(b: WidgetBounds): WidgetBounds;
  /** Holds a drag to the shape: square for a round window, absent otherwise. */
  fit?: (start: WidgetBounds, next: WidgetBounds, zone: WindowZone) => WidgetBounds;
}

export function windowLayoutFor(o: WindowLayoutOptions): WindowLayout {
  const { round, passing } = o;
  const chrome = !round && o.titlebar;
  const configured: WindowMetrics = { ...DEFAULT_WINDOW_METRICS, ...o.metrics };
  // Without a titlebar the top inset is the resize band — or, when the
  // interior passes and so cannot be the move handle, a grip strip whose
  // titlebar zone is that handle.
  const gripped = !chrome && passing;
  const m: WindowMetrics = chrome ? configured
    : { ...configured, titleH: gripped ? configured.grip : configured.edge };
  const minW = o.minWidth ?? 80;
  const minH = round ? minW : o.minHeight ?? m.titleH + m.edge + 40;
  const shape: WindowShape = { m, chrome, gripped, round, passing };
  if (round) {
    return {
      shape, minW, minH,
      clampSize(b) {
        const side = Math.max(minW, Math.min(b.width, b.height));
        return { x: b.x, y: b.y, width: side, height: side };
      },
      zoneAt: (b, x, y) => roundZoneAt(b, m, passing, x, y),
      contentRect: (b) => roundContentRect(b, m, passing),
      fit: squareDrag,
    };
  }
  return {
    shape, minW, minH,
    clampSize: (b) => ({ x: b.x, y: b.y, width: Math.max(minW, b.width), height: Math.max(minH, b.height) }),
    zoneAt: (b, x, y) => zoneAt(b, m, x, y),
    contentRect: (b) => windowContentRect(b, m),
  };
}
