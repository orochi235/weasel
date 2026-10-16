import { createMenuController, placeMenu, placeSubmenu, type Rect } from '@weasel-js/menu';
import type { ClaimableGesture, OpenMenu } from '@weasel-js/core';
import { createRevision, type HudKeyEvent, type HudPointerEvent, type Widget, type WidgetBounds } from '../widget';
import { DEFAULT_MENU_METRICS, drawPanel, panelSize, rowAt, rowLayout, type MenuMetrics } from './drawPanel';

type XY = { x: number; y: number };
const CLAIMS: readonly ClaimableGesture[] = ['pointer', 'doubleClick', 'contextMenu', 'longPress', 'wheel'];

/** What {@link createMenuWidget} needs: the open menu, how to close it, and the canvas it draws on. */
export interface MenuWidgetOptions {
  open: OpenMenu;
  /** The menu is done: an item was chosen, or it was dismissed. */
  close(): void;
  /** Viewport point to canvas CSS pixels, for `open.client`. */
  toCanvas(client: XY): XY;
  canvasSize(): { width: number; height: number };
  measure(text: string, fontSize: number): number;
  metrics?: MenuMetrics;
  onChange(): void;
}

/** A widget that draws `open` as one panel per open level, driven by a menu controller it owns. */
export function createMenuWidget(opts: MenuWidgetOptions): Widget {
  const m = opts.metrics ?? DEFAULT_MENU_METRICS;
  const rev = createRevision(opts.onChange);
  const c = createMenuController({
    entries: opts.open.entries, highlightFirst: opts.open.source === 'keyboard', onClose: opts.close,
  });
  let panels: Rect[] = [];
  let disposed = false;
  let armed = false;

  const layout = () => {
    const { width, height } = opts.canvasSize();
    const bounds = { x: 0, y: 0, w: width, h: height };
    const stack = c.stack();
    panels = [];
    stack.forEach((_, level) => {
      const size = panelSize(c.entriesAt(level), m, opts.measure);
      let at: XY;
      if (level === 0) {
        at = placeMenu(size, opts.toCanvas(opts.open.client), bounds);
      } else {
        const parent = panels[level - 1]!;
        const row = rowLayout(c.entriesAt(level - 1), m)[stack[level - 1]!]!;
        at = placeSubmenu(size, { x: parent.x, y: parent.y + row.y, w: parent.w, h: row.h }, bounds);
      }
      const panel = { x: at.x, y: at.y, w: size.w, h: size.h };
      panels.push(panel);
      c.setPanel(level, panel);
    });
  };
  layout();
  c.subscribe(() => { layout(); rev.changed(); });

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

  const pointer = (evt: HudPointerEvent) => {
    if (evt.type === 'hoverleave') { c.hover(c.stack().length - 1, null); return; }
    if (evt.type === 'cancel') { armed = false; return; }
    if (evt.type === 'down') { armed = true; return; }
    if (evt.type !== 'hovermove' && evt.type !== 'move' && evt.type !== 'up') return;
    const level = levelAt(evt.x, evt.y);
    // Only a release that follows a press here chooses: the release of the
    // right-click or long-press that opened the menu must not.
    const choose = evt.type === 'up' && armed;
    if (evt.type === 'up') armed = false;
    if (level < 0) return;
    const index = rowAt(c.entriesAt(level), m, evt.y - panels[level]!.y);
    if (!choose) c.hover(level, index, { x: evt.x, y: evt.y });
    else if (index !== null) c.press(level, index);
  };

  const key = (evt: HudKeyEvent): boolean => {
    if (evt.type !== 'keydown') return false;
    if (!evt.ctrlKey && !evt.metaKey && !evt.altKey) c.key(evt.key);
    // Every key belongs to the open menu, so no canvas binding fires under it.
    return true;
  };

  return {
    id: `weasel-menu-${opts.open.seq}`,
    get bounds() { return union(); },
    hidden: false,
    get disposed() { return disposed; },
    claims: CLAIMS,
    focusable: true,
    accessibleName: 'Context menu',
    deps: rev.deps,
    draw: (ctx) => panels.flatMap((p, level) => drawPanel(ctx, p, c.entriesAt(level), c.stack()[level] ?? null, m)),
    hitTest: (x, y) => levelAt(x, y) >= 0,
    cursorAt: () => 'default',
    onPointer: pointer,
    onKey: key,
    dispose() { disposed = true; c.dispose(); },
  };
}
