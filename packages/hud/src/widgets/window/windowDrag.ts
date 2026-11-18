import type { HudPointerEvent, WidgetBounds } from '../../widget';
import { applyWindowDrag, type WindowZone } from './zones';

/** The zone a press in `z` drags. With no titlebar to grab, the interior is the move handle — it is
 *  inert otherwise, and a window you cannot move is worse than one you cannot click through. */
export function dragZoneFor(z: WindowZone | null, chrome: boolean, passing: boolean): WindowZone | null {
  if (chrome) return z;
  if (z === 'close') return 'title';
  return !passing && z === 'content' ? 'title' : z;
}

const sameBounds = (a: WidgetBounds, b: WidgetBounds) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** What a window's drag reads and moves. */
export interface WindowDragHost {
  bounds(): WidgetBounds;
  /** The zone of the window under `(x, y)`. */
  zoneAt(x: number, y: number): WindowZone | null;
  /** The zone a press in `z` drags. */
  dragZone(z: WindowZone | null): WindowZone | null;
  minW: number;
  minH: number;
  /** `b` pulled back onto the host. */
  clampOnHost(b: WidgetBounds): WidgetBounds;
  /** Puts the window at `b`, moved through `zone`: `'title'` is a move, any other a resize. */
  place(b: WidgetBounds, zone: WindowZone): void;
  /** The close box was pressed and released. */
  close(): void;
  /** The interior was pressed and released at `p` without a drag. */
  click(p: { x: number; y: number }): void;
}

/** A window's press, drag and release: moving or resizing it, closing it, or clicking its interior. */
export interface WindowDrag {
  pointer(evt: HudPointerEvent): void;
  /** Ends any drag in flight. */
  end(): void;
}

export function createWindowDrag(host: WindowDragHost): WindowDrag {
  let dragZone: WindowZone | null = null;
  let dragStart: WidgetBounds = host.bounds();
  let dragOrigin = { x: 0, y: 0 };
  let pressZone: WindowZone | null = null;
  let pressMoved = false;

  return {
    end() { dragZone = null; pressZone = null; },
    pointer(evt) {
      switch (evt.type) {
        case 'down': {
          pressZone = host.zoneAt(evt.x, evt.y);
          pressMoved = false;
          dragZone = host.dragZone(pressZone);
          dragStart = host.bounds();
          dragOrigin = { x: evt.x, y: evt.y };
          break;
        }
        case 'move': {
          if (!dragZone || !Number.isFinite(evt.x) || !Number.isFinite(evt.y)) break;
          // The dispatcher sends a move only once the press crossed the `gestures.dragPx` kit setting.
          pressMoved = true;
          const dragged = applyWindowDrag(
            dragStart, dragZone, evt.x - dragOrigin.x, evt.y - dragOrigin.y, host.minW, host.minH,
          );
          // Only 'title' translates without resizing (zones.ts), so it is the
          // one drag where pulling the window back cannot fight the gesture.
          const next = dragZone === 'title' ? host.clampOnHost(dragged) : dragged;
          if (!sameBounds(next, host.bounds())) host.place(next, dragZone);
          break;
        }
        case 'up': {
          if (dragZone === 'close' && host.zoneAt(evt.x, evt.y) === 'close') {
            host.close();
          } else if (pressZone === 'content' && !pressMoved && Number.isFinite(evt.x) && Number.isFinite(evt.y)) {
            host.click({ x: evt.x, y: evt.y });
          }
          dragZone = null;
          pressZone = null;
          break;
        }
        case 'cancel': {
          if (dragZone && !sameBounds(host.bounds(), dragStart)) host.place(dragStart, dragZone);
          dragZone = null; pressZone = null;
          break;
        }
        // The cursor is resolved per point via `cursorAt`, so hover carries no
        // state and needs no redraw.
        default:
          break;
      }
    },
  };
}
