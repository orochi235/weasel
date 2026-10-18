import { createMenuController, withLinks, type Rect } from '@weasel-js/menu';
import { faceGeneration } from '@weasel-js/font';
import type { ClaimableGesture, OpenMenu } from '@weasel-js/core';
import { createRevision, type HudAccessibleTree, type HudKeyEvent, type HudPointerEvent, type Widget, type WidgetBounds } from '../widget';
import { accessibleMenu } from './accessibleMenu';
import { DEFAULT_MENU_METRICS, drawPanel, rowAt, type MenuIcons, type MenuMetrics } from './drawPanel';
import { measureLabel } from './measureLabel';
import { createPlacer } from './placePanels';
import { chipAt } from './valueRows';
import type { Point } from '@weasel-js/geom';

const CLAIMS: readonly ClaimableGesture[] = ['pointer', 'doubleClick', 'contextMenu', 'longPress', 'wheel'];

/** What {@link createMenuWidget} needs: the open menu, how to close it, and the canvas it draws on. */
export interface MenuWidgetOptions {
  open: OpenMenu;
  /** The menu is done: an item was chosen, or it was dismissed. */
  close(): void;
  /** Viewport point to canvas CSS pixels, for `open.client` and `open.under`. */
  toCanvas(client: Point): Point;
  canvasSize(): { width: number; height: number };
  /** Width of a label in the family the hud draws with. Defaults to the
   *  registered face's own advances, which is what the text is laid out with. */
  measure?(text: string, fontSize: number, fontFamily: string): number;
  metrics?: MenuMetrics;
  /** Where a row's icon is looked up; without it no row draws one. */
  icons?: MenuIcons;
  onChange(): void;
}

function underOnCanvas(r: Rect, toCanvas: (client: Point) => Point): Rect {
  const a = toCanvas({ x: r.x, y: r.y });
  const b = toCanvas({ x: r.x + r.w, y: r.y + r.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/** A widget that draws `open` as one panel per open level, driven by a menu controller it owns. */
export function createMenuWidget(opts: MenuWidgetOptions): Widget {
  const m = opts.metrics ?? DEFAULT_MENU_METRICS;
  const rev = createRevision(opts.onChange);
  const c = createMenuController({
    entries: withLinks(opts.open.entries, (href) => window.location.assign(href)),
    highlightFirst: opts.open.source === 'keyboard', onClose: opts.close,
  });
  const place = createPlacer({
    anchor: opts.toCanvas(opts.open.client),
    ...(opts.open.under ? { under: underOnCanvas(opts.open.under, opts.toCanvas) } : {}),
    canvasSize: opts.canvasSize,
    measure: opts.measure ?? measureLabel, metrics: m,
  });
  // The hud's font is known only once it draws.
  let family: string | null = null;
  let panels: Rect[] = place(c, family);
  let disposed = false;
  let armed = false;
  let hoverPanel: number | null = null;
  c.subscribe(() => { panels = place(c, family); rev.changed(); });

  /** The topmost panel under (x, y), or -1. */
  const levelAt = (x: number, y: number): number => {
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i]!;
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
    }
    return -1;
  };

  const union = (): WidgetBounds => {
    const x0 = Math.min(...panels.map((p) => p.x));
    const y0 = Math.min(...panels.map((p) => p.y));
    const x1 = Math.max(...panels.map((p) => p.x + p.w));
    const y1 = Math.max(...panels.map((p) => p.y + p.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  /** The pointer is now over `level` (null: no panel). Leaving a panel clears
   *  its row, as the DOM menu's per-panel `pointerleave` does. */
  const enter = (level: number | null) => {
    if (hoverPanel !== null && hoverPanel !== level) c.hover(hoverPanel, null);
    hoverPanel = level;
  };

  const pointer = (evt: HudPointerEvent) => {
    if (evt.type === 'hoverleave') { enter(null); return; }
    if (evt.type === 'cancel') { armed = false; return; }
    if (evt.type === 'down') { armed = true; return; }
    if (evt.type !== 'hovermove' && evt.type !== 'move' && evt.type !== 'up') return;
    const level = levelAt(evt.x, evt.y);
    // Only a release that follows a press here chooses: the release of the
    // right-click or long-press that opened the menu must not.
    const choose = evt.type === 'up' && armed;
    if (evt.type === 'up') armed = false;
    if (!choose) enter(level < 0 ? null : level);
    if (level < 0) return;
    const entries = c.entriesAt(level);
    const index = rowAt(entries, m, evt.y - panels[level]!.y);
    if (!choose) c.hover(level, index, { x: evt.x, y: evt.y });
    else if (index !== null) {
      c.press(level, index);
      // A number row's chips step it, since this menu has no field to type in.
      const e = entries[index];
      const dir = e?.kind === 'number' ? chipAt(panels[level]!.w, m, evt.x - panels[level]!.x) : null;
      if (e?.kind === 'number' && dir !== null) c.spin(e, dir > 0 ? 'ArrowUp' : 'ArrowDown');
    }
  };

  const key = (evt: HudKeyEvent): boolean => {
    if (evt.type !== 'keydown') return false;
    if (!evt.ctrlKey && !evt.metaKey && !evt.altKey) c.key(evt.key);
    // Every key belongs to the open menu, so no canvas binding fires under it.
    return true;
  };

  const accessibleTree: HudAccessibleTree = { read: () => accessibleMenu(c), subscribe: c.subscribe };

  return {
    id: `weasel-menu-${opts.open.seq}`,
    get bounds() { return union(); },
    hidden: false,
    get disposed() { return disposed; },
    claims: CLAIMS,
    focusable: true,
    focusRing: false,
    accessibleName: 'Context menu',
    accessibleTree,
    deps: (ctx) => [...rev.deps(), ctx.defaultFont, faceGeneration(), opts.icons?.getVersion()],
    draw: (ctx) => {
      family = ctx.defaultFont;
      panels = place(c, family);
      return panels.flatMap((p, level) => drawPanel(ctx, p, c.entriesAt(level), c.stack()[level] ?? null, m, opts.icons, c.numberValue));
    },
    hitTest: (x, y) => levelAt(x, y) >= 0,
    cursorAt: () => 'default',
    onPointer: pointer,
    onKey: key,
    dispose() { disposed = true; c.dispose(); },
  };
}
