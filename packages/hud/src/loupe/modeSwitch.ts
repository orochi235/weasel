import type { DrawCommand } from '@weasel-js/core/renderer';
import type { LoupeMode } from '@weasel-js/loupe';
import { rectContainsPointHalfOpen } from '@weasel-js/geom';
import { IDLE_PRESS } from '@weasel-js/ui-input';
import type { HudDrawCtx, HudPointerEvent, Widget, WidgetBounds } from '../widget';
import type { WindowWidget } from '../widgets/window/window';
import { lensTone } from './lensTone';
import { hudButton } from '../widgets/button';

const SEGMENTS: readonly { mode: LoupeMode; label: string }[] = [
  { mode: 'vector', label: 'Vector' },
  { mode: 'pixel', label: 'Pixel' },
];
const SEGMENT_W = 60;
const HEIGHT = 20;
/** Gap between the switch and the top of a rect lens's interior, and between its corners and a round lens's rim. */
const INSET = 10;
const CLEAR = 6;
const NOWHERE: WidgetBounds = { x: 0, y: 0, width: 0, height: 0 };

/** Where the switch sits in a lens whose interior is `r`: centered at its top, and in a round interior as high as its
 *  top corners clear the circle. Null when it does not fit in the upper third. */
export function modeSwitchBoundsIn(r: WidgetBounds, round: boolean): WidgetBounds | null {
  const width = SEGMENT_W * SEGMENTS.length;
  const x = r.x + (r.width - width) / 2;
  if (x < r.x) return null;
  const radius = r.width / 2;
  const below = round ? radius - Math.sqrt(Math.max(0, radius * radius - (width / 2) ** 2)) + CLEAR : INSET;
  const y = r.y + below;
  return below <= r.height / 3 ? { x, y, width, height: HEIGHT } : null;
}

/** What the switch reads of its lens, and tells it. */
export interface ModeSwitchHost {
  win: WindowWidget;
  round: boolean;
  mode(): LoupeMode;
  setMode(mode: LoupeMode): void;
}

/** A Vector | Pixel switch over the top of a lens. It follows the lens's window, hiding with it, and lights the
 *  lens's current mode; a click on the other segment switches to it. */
export function createModeSwitch(id: string, host: ModeSwitchHost): Widget {
  const { win } = host;
  const place = (): WidgetBounds | null => modeSwitchBoundsIn(win.contentRect, host.round);
  const segmentAt = (x: number, y: number): number => {
    const b = place();
    if (!b || !rectContainsPointHalfOpen(b, x, y)) return -1;
    return Math.min(SEGMENTS.length - 1, Math.floor((x - b.x) / SEGMENT_W));
  };
  let hovered = -1;
  let held = -1;

  return {
    id,
    get bounds() { return place() ?? NOWHERE; },
    get hidden() { return win.hidden || win.disposed === true || place() === null; },
    focusRing: false,
    dispose() {},
    deps: () => [host.mode(), hovered, held, win.contentRect.x, win.contentRect.y, win.contentRect.width],
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const b = place();
      if (!b) return [];
      const t = ctx.tokens;
      return SEGMENTS.flatMap((s, i) => {
        const on = host.mode() === s.mode;
        return hudButton.draw(
          { label: s.label, size: 'sm', press: { ...IDLE_PRESS, hovered: hovered === i, held: held === i } },
          {
            bounds: { x: b.x + i * SEGMENT_W, y: b.y, width: SEGMENT_W, height: HEIGHT },
            ctx,
            ...(on ? { fill: lensTone(t, '--wzl-surface-pressed'), hoverFill: lensTone(t, '--wzl-surface-pressed'), textColor: lensTone(t, '--wzl-accent-fg') } : {}),
          },
        );
      });
    },
    hitTest: (x, y) => !win.hidden && segmentAt(x, y) >= 0,
    cursorAt: (x, y) => (segmentAt(x, y) >= 0 ? 'pointer' : 'default'),
    onPointer(evt: HudPointerEvent) {
      const at = 'x' in evt && Number.isFinite(evt.x) && Number.isFinite(evt.y) ? segmentAt(evt.x, evt.y) : -1;
      if (evt.type === 'hovermove') hovered = at;
      else if (evt.type === 'hoverleave') hovered = -1;
      else if (evt.type === 'down') held = at;
      else if (evt.type === 'up') {
        if (held >= 0 && held === at) host.setMode(SEGMENTS[at]!.mode);
        held = -1;
      } else if (evt.type === 'cancel') held = -1;
    },
  };
}
