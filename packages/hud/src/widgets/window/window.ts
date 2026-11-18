import { createRevision } from '../../widget';
import type {
  Widget, WidgetBounds, HudDrawCtx, HudContentCtx, HudPointerEvent,
} from '../../widget';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { clampRectWithin } from '@weasel-js/geom';
import type { ColorSource } from '@weasel-js/paint';
import type { Emphasis, Grade, Stance } from '@weasel-js/theme';
import { createWindowDrag, dragZoneFor } from './windowDrag';
import { drawWindowFrame, type WindowAppearance, type WindowShape } from './windowFrame';
import {
  zoneAt, windowContentRect, cursorForZone,
  DEFAULT_WINDOW_METRICS, type WindowMetrics, type WindowZone,
} from './zones';

/** Options for a window widget. */
export interface WindowOptions {
  id: string;
  x: number; y: number; width: number; height: number;
  title: string;
  minWidth?: number;
  minHeight?: number;
  /** Draw a titlebar with the title and a close box. Default `true`. When
   *  `false` the window is bare — and dragging its interior moves it, since
   *  there is no bar to grab. A bare window whose interior passes grows a
   *  grip strip across its top to be moved by instead. */
  titlebar?: boolean;
  metrics?: Partial<WindowMetrics>;
  /** The class of content the window holds. The theme's
   *  `--wzl-stance-<stance>-<slot>` values restyle its fill, border and title,
   *  as they do a DOM panel's. */
  stance?: Stance;
  /** How serious it is. Paints the tint, border, and title in the grade's
   *  color, over the stance's, as it does a DOM panel's. */
  grade?: Grade;
  /** How loudly it reads: `high` draws the border and title in the accent,
   *  `low` draws the title muted. A grade outranks it. */
  emphasis?: Emphasis;
  /** Which of its peers the window is: an index into the theme's tint list,
   *  or a color source. Mixed into the fill at the stance's `tint-mix`. */
  tint?: number | ColorSource;
  /** Paints the interior. Drawn beneath every widget frame, clipped to
   *  `contentRect`. Receives the scene data and view the hud layer was
   *  handed — the one place hud sees either. */
  content?: (ctx: HudContentCtx) => DrawCommand[];
  onMove?: (b: WidgetBounds) => void;
  onResize?: (b: WidgetBounds) => void;
  onClose?: () => void;
  /**
   * Who takes input over the interior. `'claim'`, the default, keeps it: the
   * content is a picture, and a press on it must not act on whatever sits
   * under the window on the canvas. `'pass'` gives it up to a view the
   * interior shows — `createLoupe`'s `interactive` lens — while widgets
   * beneath still stay unreachable through it. A passing interior is never a
   * move handle and never reports `onContentClick`; a bare window moves by
   * the grip strip it grows instead.
   */
  interior?: 'claim' | 'pass';
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
  setStance(stance: Stance | undefined): void;
  setGrade(grade: Grade | undefined): void;
  setEmphasis(emphasis: Emphasis | undefined): void;
  setTint(tint: number | ColorSource | undefined): void;
  dispose(): void;
}

export function createWindow(opts: WindowOptions): WindowWidget {
  const chrome = opts.titlebar ?? true;
  const passing = opts.interior === 'pass';
  const configured: WindowMetrics = { ...DEFAULT_WINDOW_METRICS, ...opts.metrics };
  // Without a titlebar the top inset is the resize band — or, when the
  // interior passes and so cannot be the move handle, a grip strip whose
  // titlebar zone is that handle.
  const gripped = !chrome && passing;
  const m: WindowMetrics = chrome ? configured
    : { ...configured, titleH: gripped ? configured.grip : configured.edge };
  const shape: WindowShape = { m, chrome, gripped };
  const minW = opts.minWidth ?? 80;
  const minH = opts.minHeight ?? m.titleH + m.edge + 40;

  const clampSize = (b: WidgetBounds): WidgetBounds => ({
    x: b.x, y: b.y, width: Math.max(minW, b.width), height: Math.max(minH, b.height),
  });

  // No host size until a draw supplies one, so a window never drawn is not
  // clamped.
  let hostDims: { width: number; height: number } | null = null;
  const clampOnHost = (b: WidgetBounds): WidgetBounds => {
    if (!hostDims) return b;
    const r = clampRectWithin(
      b,
      { x: 0, y: 0, width: hostDims.width, height: hostDims.height },
    );
    return { ...b, x: r.x, y: r.y };
  };

  let disposed = false;
  const rev = createRevision(opts.onChange);
  let hidden = false;
  const appearance: WindowAppearance = {
    title: opts.title, stance: opts.stance, grade: opts.grade, emphasis: opts.emphasis, tint: opts.tint,
  };
  let bounds = clampSize({ x: opts.x, y: opts.y, width: opts.width, height: opts.height });

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };
  const asDrag = (z: WindowZone | null): WindowZone | null => dragZoneFor(z, chrome, passing);

  const drag = createWindowDrag({
    bounds: () => bounds,
    zoneAt: (x, y) => zoneAt(bounds, m, x, y),
    dragZone: asDrag,
    minW, minH, clampOnHost,
    place(b, zone) {
      bounds = b;
      (zone === 'title' ? opts.onMove : opts.onResize)?.(bounds);
      rev.changed();
    },
    close() { opts.onClose?.(); },
    click(p) { opts.onContentClick?.(p); },
  });

  return {
    id: opts.id,
    deps: rev.deps,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    get contentRect() { return windowContentRect(bounds, m); },
    cursorAt(x, y) { const z = asDrag(zoneAt(bounds, m, x, y)); return z ? cursorForZone(z) : 'default'; },
    content: opts.content,

    // Ends any drag in flight: `dragStart` would otherwise still hold the
    // pre-call bounds, so the next move would rebase from stale origin.
    setBounds(b) { assertNotDisposed(); bounds = clampOnHost(clampSize(b)); drag.end(); rev.changed(); },
    setHidden(h) { assertNotDisposed(); hidden = h; rev.changed(); },
    setTitle(t) { assertNotDisposed(); appearance.title = t; rev.changed(); },
    setStance(st) { assertNotDisposed(); appearance.stance = st; rev.changed(); },
    setGrade(g) { assertNotDisposed(); appearance.grade = g; rev.changed(); },
    setEmphasis(e) { assertNotDisposed(); appearance.emphasis = e; rev.changed(); },
    setTint(t) { assertNotDisposed(); appearance.tint = t; rev.changed(); },

    draw(ctx: HudDrawCtx): DrawCommand[] {
      hostDims = ctx.dims;
      return drawWindowFrame(ctx, bounds, shape, appearance);
    },

    hitTest(px, py) {
      if (hidden) return false;
      const z = zoneAt(bounds, m, px, py);
      return z !== null && !(passing && z === 'content');
    },

    passes(px, py) {
      return passing && !hidden && zoneAt(bounds, m, px, py) === 'content';
    },

    onPointer(evt: HudPointerEvent): void { drag.pointer(evt); },

    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
