import { createMenuController, withLinks, type MenuController, type Rect } from '@weasel-js/menu';
import { faceGeneration } from '@weasel-js/font';
import type { ClaimableGesture, OpenMenu } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';
import { createRevision, type HudAccessibleTree, type HudTextInput, type HudKeyEvent, type HudPointerEvent, type Widget, type WidgetBounds } from '../widget';
import { accessibleMenu } from './accessibleMenu';
import { DEFAULT_MENU_METRICS, drawPanel, rowAt, rowLayout, type MenuIcons, type MenuMetrics } from './drawPanel';
import { measureLabel } from './measureLabel';
import { createPlacer } from './placePanels';
import { caretAt, caretX } from './valueRows';
import { createTextEditor, editMods } from './textEdit';
import { DEFAULT_MENU_PALETTE, withColorPickers } from './colorPicker';
import type { Point } from '@weasel-js/geom';
import type { StepRepeatOptions } from '@weasel-js/headless';
import { chipUnder, createChipHold, levelAt } from './chipRepeat';

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
  /** The swatches a color row's picker offers, as `#rrggbb`. Default {@link DEFAULT_MENU_PALETTE}. */
  palette?: readonly string[];
  /** The timing of a held number chip. Defaults to `REPEAT_DELAY_MS` and `REPEAT_EVERY_MS` from `@weasel-js/headless`,
   *  the defaults a `@weasel-js/ui` number field's steppers hold with. */
  repeat?: StepRepeatOptions;
  onChange(): void;
}

function underOnCanvas(r: Rect, toCanvas: (client: Point) => Point): Rect {
  const a = toCanvas({ x: r.x, y: r.y });
  const b = toCanvas({ x: r.x + r.w, y: r.y + r.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/** The box around every panel. */
function union(panels: readonly Rect[]): WidgetBounds {
  const x0 = Math.min(...panels.map((p) => p.x));
  const y0 = Math.min(...panels.map((p) => p.y));
  const x1 = Math.max(...panels.map((p) => p.x + p.w));
  const y1 = Math.max(...panels.map((p) => p.y + p.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The edit `typing` runs as a widget's text input: its caret's place on the canvas, read off `panels()`, and its
 *  composition. `measure` gives the width of a run of a row's text. */
function menuTextInput(
  c: Pick<MenuController, 'entriesAt'>, typing: ReturnType<typeof createTextEditor>, panels: () => readonly Rect[],
  m: MenuMetrics, measure: (text: string) => number, subscribe: HudTextInput['subscribe'],
): HudTextInput {
  const read = () => {
    const edit = typing.current();
    const ps = panels();
    for (let level = 0; edit && level < ps.length; level++) {
      const entries = c.entriesAt(level);
      const i = entries.indexOf(edit.entry);
      if (i < 0) continue;
      const p = ps[level]!, r = rowLayout(entries, m)[i]!;
      const x = p.x + caretX(edit, p.w, m, measure);
      return { rect: { x, y: p.y + r.y, w: Math.max(1, p.x + p.w - x), h: r.h }, label: edit.entry.label };
    }
    return null;
  };
  return { read, subscribe, compose: typing.compose, insert: typing.insert };
}

/** A widget that draws `open` as one panel per open level, driven by a menu controller it owns. */
export function createMenuWidget(opts: MenuWidgetOptions): Widget {
  const m = opts.metrics ?? DEFAULT_MENU_METRICS;
  const measure = opts.measure ?? measureLabel;
  const edits = createEmitter();
  const rev = createRevision(() => { opts.onChange(); edits.emit(); });
  const pickers = withColorPickers(
    withLinks(opts.open.entries, (href) => window.location.assign(href)), opts.palette ?? DEFAULT_MENU_PALETTE, () => c,
  );
  const c = createMenuController({
    entries: pickers.entries, highlightFirst: opts.open.source === 'keyboard', onClose: opts.close,
  });
  const place = createPlacer({
    anchor: opts.toCanvas(opts.open.client),
    ...(opts.open.under ? { under: underOnCanvas(opts.open.under, opts.toCanvas) } : {}),
    canvasSize: opts.canvasSize,
    measure, metrics: m,
  });
  // The hud's font is known only once it draws.
  let family: string | null = null;
  let panels: Rect[] = place(c, family);
  let disposed = false;
  let armed = false;
  let hoverPanel: number | null = null;
  const typing = createTextEditor(c, rev.changed);
  const chips = createChipHold(c, (x, y) => chipUnder(c, panels, m, x, y), opts.repeat);
  c.subscribe(() => { panels = place(c, family); rev.changed(); });

  /** The pointer is now over `level` (null: no panel). Leaving a panel clears
   *  its row, as the DOM menu's per-panel `pointerleave` does. */
  const enter = (level: number | null) => {
    if (hoverPanel !== null && hoverPanel !== level) c.hover(hoverPanel, null);
    hoverPanel = level;
  };

  const pointer = (evt: HudPointerEvent) => {
    if (evt.type === 'hoverleave') { enter(null); return; }
    if (evt.type === 'cancel') { armed = false; chips.stop(); return; }
    if (evt.type === 'down') {
      armed = true;
      // A number row's chips step it, since this menu has no field to type in: once on the press, then
      // repeating while held, as a number field's steppers do.
      chips.press(evt.x, evt.y);
      return;
    }
    if (evt.type !== 'hovermove' && evt.type !== 'move' && evt.type !== 'up') return;
    chips.follow(evt.type === 'up' ? null : evt);
    const level = levelAt(panels, evt.x, evt.y);
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
      typing.leave(entries[index]);
      c.press(level, index);
      typing.start(entries[index]);
      const e = entries[index];
      const { w } = panels[level]!, x = evt.x - panels[level]!.x;
      typing.place(e, (draft) => caretAt(draft, w, m, x, (s) => measure(s, m.fontSize, family ?? '')));
    }
  };

  const key = (evt: HudKeyEvent): boolean => {
    if (evt.type !== 'keydown') return false;
    if (typing.key(evt.key, editMods(evt))) return true;
    const level = c.stack().length - 1;
    const at = c.stack()[level];
    const row = at == null ? undefined : c.entriesAt(level)[at];
    if (evt.key === 'Enter' && row?.kind === 'text') typing.start(row);
    else if (!evt.ctrlKey && !evt.metaKey && !evt.altKey) c.key(evt.key);
    // Every key belongs to the open menu, so no canvas binding fires under it.
    return true;
  };

  const accessibleTree: HudAccessibleTree = { read: () => accessibleMenu(c, pickers.swatchOf), subscribe: c.subscribe };

  return {
    id: `weasel-menu-${opts.open.seq}`,
    get bounds() { return union(panels); },
    hidden: false,
    get disposed() { return disposed; },
    claims: CLAIMS,
    focusable: true,
    focusRing: false,
    accessibleName: 'Context menu',
    accessibleTree,
    textInput: menuTextInput(c, typing, () => panels, m, (s) => measure(s, m.fontSize, family ?? ''), edits.subscribe),
    deps: (ctx) => [...rev.deps(), ctx.defaultFont, faceGeneration(), opts.icons?.getVersion()],
    draw: (ctx) => {
      family = ctx.defaultFont;
      panels = place(c, family);
      const values = {
        number: c.numberValue, text: c.textValue, editing: typing.current(), swatch: pickers.swatchOf,
        measure,
      };
      return panels.flatMap((p, level) => drawPanel(ctx, p, c.entriesAt(level), c.stack()[level] ?? null, m, opts.icons, values));
    },
    hitTest: (x, y) => levelAt(panels, x, y) >= 0,
    cursorAt: () => 'default',
    onPointer: pointer,
    onKey: key,
    dispose() {
      // Dismissed mid-edit, the menu keeps what was typed, as the DOM menu's field does on blur.
      typing.leave();
      chips.stop();
      disposed = true;
      c.dispose();
    },
  };
}
