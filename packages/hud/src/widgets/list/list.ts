import type { DrawCommand } from '@weasel-js/core/renderer';
import {
  LIST_ROLES, fixedWidth, listMode, measureRowList, rowAtY, type ListMode, type RowListLayout,
} from '@weasel-js/ui-logic';
import { createEmitter } from '@weasel-js/registry';
import { resolveTheme, weaselTheme, type ResolvedTheme } from '@weasel-js/theme';
import { createRevision, DEFAULT_WIDGET_CLAIMS } from '../../widget';
import type {
  HudAccessibleNode, HudAccessibleTree, HudDrawCtx, HudKeyEvent, HudPointerEvent, Widget, WidgetBounds,
} from '../../widget';
import { hudMeasureEnv } from '../../measureEnv';
import { DEFAULT_FONT_FAMILY } from '../../fonts/registerDefaultFont';
import { hudItemList, SWATCH_SIZE, type HudListRow } from './drawList';
import { createListNav } from './listNav';
import { rectContainsPointHalfOpen } from '@weasel-js/geom';
import type { ClaimableGesture } from '@weasel-js/core';

/** Options for a list widget. */
export interface ListOptions {
  id: string;
  x: number; y: number; width: number;
  /** Default: as tall as its rows, measured again whenever they or the theme change. Shorter than its rows, the list
   *  clips them and scrolls: by the wheel, and to keep the keyboard's row in view. */
  height?: number;
  rows: readonly HudListRow[];
  /** Shown in place of the rows when there are none. */
  empty?: string;
  /** Whether rows are selectable, and how many at once. As with ui's `ItemList`, the list announces `selected`;
   *  what is selected stays with `onActivate`. */
  selectionMode?: 'single' | 'multiple';
  /** A row was pressed, or Enter or Space was pressed on it. */
  onActivate?(id: string, index: number): void;
  /** What assistive tech calls the list. */
  accessibleName?: string;
  fontFamily?: string;
  /** Position in the HUD's tab order; see {@link Widget.tabOrder}. */
  tabOrder?: number;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget from its HUD's list. */
  removeFromHud?: () => void;
}

/** A flat column of rows drawn on the HUD, with ui's `ItemList`'s keyboard: Up and Down, Home and End,
 *  typeahead, and Enter or Space to activate. Focusable when it selects or activates. */
export interface ListWidget extends Widget {
  setRows(rows: readonly HudListRow[]): void;
  /** A height given fixes the list's height, as `height` does at creation; one left out has it follow its rows. */
  setBounds(b: Omit<WidgetBounds, 'height'> & { height?: number }): void;
  setHidden(hidden: boolean): void;
  /** The row the keyboard is on. */
  readonly active: number | null;
  /** How far the rows are scrolled up, in px: 0 unless the list is shorter than its rows. */
  readonly scrollTop: number;
  dispose(): void;
}

let builtIn: ResolvedTheme | null = null;
const SCROLLING_CLAIMS: readonly ClaimableGesture[] = [...DEFAULT_WIDGET_CLAIMS, 'wheel'];

/** A list's rows as its assistive tech tree: the container and row roles its mode gives, the keyboard's row active. */
function listTree(
  opts: ListOptions, mode: ListMode, rows: readonly HudListRow[], active: number | null,
): HudAccessibleNode {
  const roles = LIST_ROLES[mode];
  const selects = opts.selectionMode !== undefined && mode !== 'list';
  return {
    role: roles.container, key: 'list', label: opts.accessibleName ?? opts.id,
    ...(opts.selectionMode === 'multiple' && selects ? { multiselectable: true } : {}),
    children: rows.map((r, i): HudAccessibleNode => ({
      role: roles.row, key: r.id, label: r.label,
      ...(i === active ? { active: true } : {}),
      ...(selects ? { selected: !!r.selected } : {}),
    })),
  };
}

export function createList(opts: ListOptions): ListWidget {
  const rev = createRevision(opts.onChange);
  let subs = createEmitter();
  const mode = listMode({ selectionMode: opts.selectionMode, activatable: opts.onActivate !== undefined });
  let disposed = false;
  let hidden = false;
  let rows: readonly HudListRow[] = [];
  let lastCtx: Pick<HudDrawCtx, 'tokens' | 'defaultFont'> | null = null;
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height ?? 0 };
  let fixedHeight = opts.height !== undefined;
  let scrollTop = 0;
  const nav = createListNav(() => rows, mode, (i) => opts.onActivate?.(rows[i]!.id, i));

  const changed = () => { rev.changed(); subs.emit(); };
  const assertLive = () => { if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.'); };
  const measure = (): RowListLayout & { height: number } => {
    const ctx = lastCtx ?? { tokens: (builtIn ??= resolveTheme(weaselTheme)), defaultFont: DEFAULT_FONT_FAMILY };
    const m = measureRowList(
      { rows, empty: opts.empty }, fixedWidth(bounds.width),
      hudMeasureEnv(ctx, opts.fontFamily),
    );
    return { ...m.layout, height: m.height };
  };
  /** Follow the rows' height, when the caller gave none. True when it moved. */
  const fit = (): boolean => {
    if (fixedHeight) return false;
    const h = measure().height;
    if (h === bounds.height) return false;
    bounds = { ...bounds, height: h };
    return true;
  };
  /** Hold the scroll within the rows' overflow; true when it moved. */
  const holdScroll = (to: number): boolean => {
    const max = Math.max(0, measure().height - bounds.height);
    const next = Math.min(Math.max(0, to), max);
    if (next === scrollTop) return false;
    scrollTop = next;
    return true;
  };
  /** Scroll the keyboard's row into view, as a focused DOM row scrolls itself. */
  const reveal = (): void => {
    const r = nav.active === null ? undefined : measure().rows[nav.active]?.rect;
    if (!r) return;
    if (r.y < scrollTop) holdScroll(r.y);
    else if (r.y + r.height > scrollTop + bounds.height) holdScroll(r.y + r.height - bounds.height);
  };
  const setRowsInner = (next: readonly HudListRow[]) => {
    const prev = rows;
    rows = next.map((r) => (r.swatch !== undefined ? { ...r, leadingWidth: SWATCH_SIZE } : r));
    nav.rebase(prev);
    fit();
    holdScroll(scrollTop);
  };
  setRowsInner(opts.rows);
  // Only a row drawn in the bounds is under a point: a scrolled-out one is clipped away.
  const rowAt = (x: number, y: number): number | null =>
    (rectContainsPointHalfOpen(bounds, x, y) ? rowAtY(measure(), y - bounds.y + scrollTop) : null);
  const overflows = () => measure().height > bounds.height;
  const tree: HudAccessibleTree = {
    read: () => listTree(opts, mode, rows, nav.active),
    subscribe: (fn) => subs.subscribe(fn),
  };

  return {
    id: opts.id,
    deps: rev.deps,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    get active() { return nav.active; },
    get scrollTop() { return scrollTop; },
    // The wheel is the list's only while it has rows to scroll to; otherwise it falls through to the canvas.
    get claims() { return overflows() ? SCROLLING_CLAIMS : DEFAULT_WIDGET_CLAIMS; },
    focusable: mode !== 'list',
    focusRing: false,
    ...(opts.tabOrder !== undefined ? { tabOrder: opts.tabOrder } : {}),
    accessibleName: opts.accessibleName ?? opts.id,
    accessibleTree: tree,
    setRows(next) { assertLive(); setRowsInner(next); changed(); },
    setBounds(b) {
      assertLive();
      fixedHeight = b.height !== undefined;
      bounds = { x: b.x, y: b.y, width: b.width, height: b.height ?? bounds.height };
      fit();
      holdScroll(scrollTop);
      changed();
    },
    setHidden(h) { assertLive(); hidden = h; changed(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      if (lastCtx?.tokens !== ctx.tokens || lastCtx.defaultFont !== ctx.defaultFont) {
        lastCtx = { tokens: ctx.tokens, defaultFont: ctx.defaultFont };
        // A theme with taller rows: the new height lands on the next frame.
        const grew = fit();
        if (holdScroll(scrollTop) || grew) changed();
      }
      return hudItemList.draw(
        { rows, empty: opts.empty, mode, active: nav.active, hover: nav.hover, ring: nav.ring, scrollTop },
        { bounds, ctx, fontFamily: opts.fontFamily },
      );
    },
    hitTest(x, y) {
      return !hidden && rectContainsPointHalfOpen(bounds, x, y);
    },
    cursorAt() { return 'default'; },
    onPointer(evt: HudPointerEvent) {
      if (evt.type === 'wheel') {
        if (!holdScroll(scrollTop + evt.deltaY)) return;
        // The rows moved under a still pointer, so the hover follows the point, as `:hover` does.
        nav.pointer({ type: 'hovermove', x: evt.x, y: evt.y, native: evt.native }, rowAt);
        changed();
        return;
      }
      if (nav.pointer(evt, rowAt)) changed();
    },
    onKey(evt: HudKeyEvent): boolean {
      const r = nav.key(evt);
      if (r.changed) { reveal(); changed(); }
      return r.handled;
    },
    onFocusChange(f: boolean) { if (nav.focus(f)) { reveal(); changed(); } },
    dispose() {
      if (disposed) return;
      disposed = true;
      subs = createEmitter();
      opts.removeFromHud?.();
    },
  };
}
