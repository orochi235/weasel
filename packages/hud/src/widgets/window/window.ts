import { createRevision } from '../../widget';
import type {
  Widget, WidgetBounds, HudDrawCtx, HudContentCtx, HudPointerEvent,
} from '../../widget';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ColorSource } from '@weasel-js/paint';
import type { Emphasis, Grade, Stance } from '@weasel-js/theme';
import { createHostHold, createWindowDrag, dragZoneFor } from './windowDrag';
import { drawWindowFrame, type WindowAppearance } from './windowFrame';
import { cursorForZone, type WindowMetrics, type WindowZone } from './zones';
import { windowLayoutFor } from './windowLayout';

/** Options for a window widget. */
export interface WindowOptions {
  id: string;
  x: number; y: number; width: number; height: number;
  title: string;
  /**
   * The window's outline. `'rect'`, the default, is a box with a titlebar. `'round'` is a circle inscribed in square
   * bounds: always bare, resized from its rim, with its interior clipped to the circle; its bounds stay square.
   */
  shape?: WindowShapeKind;
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

/** A window's outline: a titled box, or a bare circle. */
export type WindowShapeKind = 'rect' | 'round';

export function createWindow(opts: WindowOptions): WindowWidget {
  const passing = opts.interior === 'pass';
  const layout = windowLayoutFor({
    round: opts.shape === 'round', titlebar: opts.titlebar ?? true, passing,
    metrics: opts.metrics, minWidth: opts.minWidth, minHeight: opts.minHeight,
  });
  const { shape, minW, minH, clampSize } = layout;
  const { chrome, round } = shape;
  const zoneOf = (x: number, y: number): WindowZone | null => layout.zoneAt(bounds, x, y);

  const host = createHostHold();
  const clampOnHost = host.clamp;

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
  // True while the window reports a move or resize it made itself, so a `setBounds` from that report (a snap, an
  // aspect lock) overrides this step of the drag rather than ending it.
  let reporting = false;
  const report = (zone: WindowZone) => {
    reporting = true;
    try { (zone === 'title' ? opts.onMove : opts.onResize)?.(bounds); } finally { reporting = false; }
  };

  const drag = createWindowDrag({
    bounds: () => bounds,
    zoneAt: zoneOf,
    dragZone: asDrag,
    ...(layout.fit ? { fit: layout.fit } : {}),
    minW, minH, clampOnHost,
    place(b, zone) {
      bounds = b;
      report(zone);
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
    shape: round ? 'round' : 'rect',
    get contentRect() { return layout.contentRect(bounds); },
    cursorAt(x, y) { const z = asDrag(zoneOf(x, y)); return z ? cursorForZone(z) : 'default'; },
    content: opts.content,

    // Ends any drag in flight: `dragStart` would otherwise still hold the
    // pre-call bounds, so the next move would rebase from stale origin. Called
    // from the window's own onMove or onResize, it only overrides where this
    // step of the drag put the window; the drag goes on from where it began.
    setBounds(b) {
      assertNotDisposed();
      bounds = clampOnHost(clampSize(b));
      if (!reporting) drag.end();
      rev.changed();
    },
    setHidden(h) { assertNotDisposed(); hidden = h; rev.changed(); },
    setTitle(t) { assertNotDisposed(); appearance.title = t; rev.changed(); },
    setStance(st) { assertNotDisposed(); appearance.stance = st; rev.changed(); },
    setGrade(g) { assertNotDisposed(); appearance.grade = g; rev.changed(); },
    setEmphasis(e) { assertNotDisposed(); appearance.emphasis = e; rev.changed(); },
    setTint(t) { assertNotDisposed(); appearance.tint = t; rev.changed(); },

    // A host that changed size pulls the window back onto it, as a move would, so a canvas narrowed past the window
    // never leaves its titlebar out of reach.
    draw(ctx: HudDrawCtx): DrawCommand[] {
      if (host.resize(ctx.dims)) {
        const held = clampOnHost(bounds);
        if (held.x !== bounds.x || held.y !== bounds.y) {
          bounds = held;
          report('title');
          rev.changed();
        }
      }
      return drawWindowFrame(ctx, bounds, shape, appearance);
    },

    hitTest(px, py) {
      if (hidden) return false;
      const z = zoneOf(px, py);
      return z !== null && !(passing && z === 'content');
    },

    passes(px, py) {
      return passing && !hidden && zoneOf(px, py) === 'content';
    },

    onPointer(evt: HudPointerEvent): void { drag.pointer(evt); },

    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
