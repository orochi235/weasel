import type { HudPointerEvent, Widget } from './widget';

/** The widget the pointer is over, told as the pointer enters it, moves within it and leaves it. */
export interface Hover {
  /** The pointer moved to `(sx, sy)`, over `hit`. */
  move(hit: Widget | null, sx: number, sy: number, native: PointerEvent): void;
  /** The pointer left the canvas. */
  leave(): void;
  /** Lets the hovered widget go without a redraw, as the HUD detaches. */
  clear(): void;
}

/** `redraw` hears every change of the hovered widget but the one `clear` makes. */
export function createHover(redraw: () => void): Hover {
  let hovered: Widget | null = null;
  const release = (): boolean => {
    if (!hovered) return false;
    hovered.onPointer({ type: 'hoverleave', native: null } satisfies HudPointerEvent);
    hovered = null;
    return true;
  };

  return {
    move(hit, sx, sy, native) {
      if (hit !== hovered) {
        if (hovered) hovered.onPointer({ type: 'hoverleave', native } satisfies HudPointerEvent);
        hovered = hit;
        redraw();
      }
      // Every move inside the widget, not only the one that entered it: the
      // event carries `x`/`y`, and a widget tracking hover position reads a
      // frozen point otherwise.
      if (hit) hit.onPointer({ type: 'hovermove', x: sx, y: sy, native } satisfies HudPointerEvent);
    },
    leave() { if (release()) redraw(); },
    clear() { release(); },
  };
}
