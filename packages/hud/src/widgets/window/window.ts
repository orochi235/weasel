import type {
  Widget, WidgetBounds, HudDrawCtx, HudContentCtx, HudPointerEvent,
} from '../../widget';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { textCommandFromRuns, pathFromD } from '@weasel-js/core';
import {
  zoneAt, windowContentRect, applyWindowDrag, cursorForZone,
  DEFAULT_WINDOW_METRICS, type WindowMetrics, type WindowZone,
} from './zones';

/** How far a press may travel and still count as a click on the interior.
 *  Above this the press is a drag — which, on a bare window, moves it. */
const CLICK_SLOP = 3;

/** Options for a window widget. */
export interface WindowOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  title: string;
  minW?: number;
  minH?: number;
  /** Draw a titlebar with the title and a close box. Default `true`. When
   *  `false` the window is bare — and dragging its interior moves it, since
   *  there is no bar to grab. */
  titlebar?: boolean;
  metrics?: Partial<WindowMetrics>;
  /** Paints the interior. Drawn beneath every widget frame, clipped to
   *  `contentRect`. Receives the scene data and view the hud layer was
   *  handed — the one place hud sees either. */
  content?: (ctx: HudContentCtx) => DrawCommand[];
  onMove?: (b: WidgetBounds) => void;
  onResize?: (b: WidgetBounds) => void;
  onClose?: () => void;
  /** A press and release inside the interior that never became a drag,
   *  reported at the release point in screen-space CSS px. Fires whether or
   *  not the interior doubles as the move handle. */
  onContentClick?: (p: { x: number; y: number }) => void;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose(). */
  removeFromHud?: () => void;
}

/**
 * A draggable, edge-resizable frame with an optional titlebar and close box.
 * The frame is all it draws; an interior comes from the `content` painter,
 * clipped to `contentRect`. `createLoupe` is the worked example.
 */
export interface WindowWidget extends Widget {
  readonly contentRect: WidgetBounds;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  setTitle(title: string): void;
  dispose(): void;
}

export function createWindow(opts: WindowOptions): WindowWidget {
  const chrome = opts.titlebar ?? true;
  const configured: WindowMetrics = { ...DEFAULT_WINDOW_METRICS, ...opts.metrics };
  // Without a titlebar the top inset is just the resize band, which keeps the
  // content clear of it and makes `zoneAt`'s titlebar branch unreachable.
  const m: WindowMetrics = chrome ? configured : { ...configured, titleH: configured.edge };
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
  let pressZone: WindowZone | null = null;
  let pressMoved = false;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  // With no titlebar to grab, the interior is the move handle — it is inert
  // otherwise, and a window you cannot move is worse than one you cannot
  // click through.
  const asDrag = (z: WindowZone | null): WindowZone | null =>
    !chrome && z === 'content' ? 'title' : z;

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
    get disposed() { return disposed; },
    get contentRect() { return windowContentRect(bounds, m); },
    cursorAt(x, y) { const z = asDrag(zoneAt(bounds, m, x, y)); return z ? cursorForZone(z) : 'default'; },
    content: opts.content,

    // Ends any drag in flight: `dragStart` would otherwise still hold the
    // pre-call bounds, so the next move would rebase from stale origin.
    setBounds(b) { assertNotDisposed(); bounds = clamp(b); dragZone = null; pressZone = null; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setTitle(t) { assertNotDisposed(); title = t; opts.onChange?.(); },

    draw(ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const out: DrawCommand[] = [];

      // The grab bands sit outside contentRect, so nothing else paints them —
      // without these the scene shows through the window's own border. The
      // titlebar, when there is one, is the top band.
      const band = ctx.tokens['--wzl-surface-raised'];
      const below = y + m.titleH;
      const bandH = h - m.titleH;
      const rects = [
        { x, y, width: w, height: m.titleH },
        { x, y: below, width: m.edge, height: bandH },
        { x: x + w - m.edge, y: below, width: m.edge, height: bandH },
        { x: x + m.edge, y: y + h - m.edge, width: w - m.edge * 2, height: m.edge },
      ];
      for (const r of rects) {
        out.push({ kind: 'path', path: { kind: 'rect', ...r }, fill: { fill: 'solid', color: band } });
      }

      // Border ring: a stroked rect, no fill, so the interior stays a hole
      // for the content painter drawn beneath this widget.

      const ring: PathDrawCommand = {
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        stroke: { paint: { fill: 'solid', color: ctx.tokens['--wzl-border'] }, width: 1 },
      };
      out.push(ring);

      if (!chrome) return out;

      out.push(textCommandFromRuns(
        x + m.edge + 2, y,
        [{ text: title, fill: { fill: 'solid', color: ctx.tokens['--wzl-fg-muted'] } }],
        {
          fontFamily: ctx.defaultFont,
          fontSize: 12,
        },
        // Reserve the close box so a long title is ellipsized rather than
        // running under the ✕.
        w - m.edge * 2 - m.closeSize - 4,
        m.titleH,
        'center',
      ));

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

    onPointer(evt: HudPointerEvent): void {
      switch (evt.type) {
        case 'down': {
          pressZone = zoneAt(bounds, m, evt.x, evt.y);
          pressMoved = false;
          dragZone = asDrag(pressZone);
          dragStart = bounds;
          dragOrigin = { x: evt.x, y: evt.y };
          break;
        }
        case 'move': {
          if (!dragZone) break;
          if (Math.hypot(evt.x - dragOrigin.x, evt.y - dragOrigin.y) > CLICK_SLOP) {
            pressMoved = true;
          }
          const next = applyWindowDrag(
            dragStart, dragZone, evt.x - dragOrigin.x, evt.y - dragOrigin.y, minW, minH,
          );
          if (next.x !== bounds.x || next.y !== bounds.y || next.w !== bounds.w || next.h !== bounds.h) {
            bounds = next;
            (dragZone === 'title' ? opts.onMove : opts.onResize)?.(bounds);
            opts.onChange?.();
          }
          break;
        }
        case 'up': {
          if (dragZone === 'close' && zoneAt(bounds, m, evt.x, evt.y) === 'close') {
            opts.onClose?.();
          } else if (pressZone === 'content' && !pressMoved) {
            opts.onContentClick?.({ x: evt.x, y: evt.y });
          }
          dragZone = null;
          pressZone = null;
          break;
        }
        case 'cancel': {
          if (dragZone) {
            bounds = dragStart;
            dragZone = null;
            opts.onChange?.();
          }
          pressZone = null;
          break;
        }
        // The cursor is resolved per point via `cursorAt`, so hover carries no
        // state and needs no redraw.
        default:
          break;
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
