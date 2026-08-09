import type {
  Widget, WidgetBounds, HudDrawCtx, HudContentCtx, HudPointerEvent, PointerClaim,
} from '../../widget';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { textCommand, pathFromD } from '@weasel-js/core';
import {
  zoneAt, windowContentRect, applyWindowDrag, cursorForZone,
  DEFAULT_WINDOW_METRICS, type WindowMetrics, type WindowZone,
} from './zones';

export interface WindowOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  title: string;
  minW?: number;
  minH?: number;
  metrics?: Partial<WindowMetrics>;
  /** Paints the interior. Drawn beneath every widget frame, clipped to
   *  `contentRect`. Receives the scene data and view the hud layer was
   *  handed — the one place hud sees either. */
  content?: (ctx: HudContentCtx) => DrawCommand[];
  onMove?: (b: WidgetBounds) => void;
  onResize?: (b: WidgetBounds) => void;
  onClose?: () => void;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose(). */
  removeFromHud?: () => void;
}

export interface WindowWidget extends Widget {
  readonly contentRect: WidgetBounds;
  /** CSS cursor for the last hovered zone; `'default'` when not hovered. */
  readonly cursor: string;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  setTitle(title: string): void;
  dispose(): void;
}

export function createWindow(opts: WindowOptions): WindowWidget {
  const m: WindowMetrics = { ...DEFAULT_WINDOW_METRICS, ...opts.metrics };
  const minW = opts.minW ?? 80;
  const minH = opts.minH ?? m.titleH + m.edge + 40;

  const clamp = (b: WidgetBounds): WidgetBounds => ({
    x: b.x, y: b.y, w: Math.max(minW, b.w), h: Math.max(minH, b.h),
  });

  let disposed = false;
  let hidden = false;
  let title = opts.title;
  let bounds = clamp({ x: opts.x, y: opts.y, w: opts.w, h: opts.h });
  let dragZone: WindowZone | null = null;
  let dragStart: WidgetBounds = bounds;
  let dragOrigin = { x: 0, y: 0 };
  let hoverZone: WindowZone | null = null;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  const closeBox = (): WidgetBounds => ({
    x: bounds.x + bounds.w - m.edge - m.closeSize,
    y: bounds.y + (m.titleH - m.closeSize) / 2,
    w: m.closeSize,
    h: m.closeSize,
  });

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get contentRect() { return windowContentRect(bounds, m); },
    get cursor() { return hoverZone ? cursorForZone(hoverZone) : 'default'; },
    content: opts.content,

    // Ends any drag in flight: `dragStart` would otherwise still hold the
    // pre-call bounds, so the next move would rebase from stale origin.
    setBounds(b) { assertNotDisposed(); bounds = clamp(b); dragZone = null; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setTitle(t) { assertNotDisposed(); title = t; opts.onChange?.(); },

    draw(ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const out: DrawCommand[] = [];

      const titlebar: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: m.titleH },
        fill: { fill: 'solid', color: ctx.tokens['--wzl-surface-raised'] },
      };
      out.push(titlebar);

      // Border ring: a stroked rect, no fill, so the interior stays a hole
      // for the content painter drawn beneath this widget.
      const ring: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        stroke: { paint: { fill: 'solid', color: ctx.tokens['--wzl-border'] }, width: 1 },
      };
      out.push(ring);

      out.push(textCommand(x + m.edge + 2, y + m.titleH / 2 + 4, title, {
        fontFamily: ctx.defaultFont,
        fontSize: 12,
        fill: { fill: 'solid', color: ctx.tokens['--wzl-fg-muted'] },
      }));

      const c = closeBox();
      const inset = 3;
      const x0 = c.x + inset, y0 = c.y + inset;
      const x1 = c.x + c.w - inset, y1 = c.y + c.h - inset;
      out.push({
        kind: 'path',
        path: pathFromD(`M ${x0} ${y0} L ${x1} ${y1} M ${x1} ${y0} L ${x0} ${y1}`),
        stroke: { paint: { fill: 'solid', color: ctx.tokens['--wzl-fg-muted'] }, width: 1.5, cap: 'round' },
      });

      return out;
    },

    hitTest(px, py) {
      if (hidden) return false;
      return zoneAt(bounds, m, px, py) !== null;
    },

    onPointer(evt: HudPointerEvent): PointerClaim {
      switch (evt.type) {
        case 'down': {
          dragZone = zoneAt(bounds, m, evt.x, evt.y);
          dragStart = bounds;
          dragOrigin = { x: evt.x, y: evt.y };
          // Claim unconditionally: an unclaimed press inside the window
          // reaches the scene beneath it and acts on the wrong thing.
          return 'claim';
        }
        case 'move': {
          if (!dragZone) return 'claim';
          const next = applyWindowDrag(
            dragStart, dragZone, evt.x - dragOrigin.x, evt.y - dragOrigin.y, minW, minH,
          );
          if (next.x !== bounds.x || next.y !== bounds.y || next.w !== bounds.w || next.h !== bounds.h) {
            bounds = next;
            (dragZone === 'title' ? opts.onMove : opts.onResize)?.(bounds);
            opts.onChange?.();
          }
          return 'claim';
        }
        case 'up': {
          if (dragZone === 'close' && zoneAt(bounds, m, evt.x, evt.y) === 'close') {
            opts.onClose?.();
          }
          dragZone = null;
          return 'claim';
        }
        case 'cancel': {
          if (dragZone) {
            bounds = dragStart;
            dragZone = null;
            opts.onChange?.();
          }
          return 'claim';
        }
        case 'hovermove': {
          const z = zoneAt(bounds, m, evt.x, evt.y);
          if (z !== hoverZone) { hoverZone = z; opts.onChange?.(); }
          return 'pass';
        }
        case 'hoverleave': {
          if (hoverZone) { hoverZone = null; opts.onChange?.(); }
          return 'pass';
        }
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
