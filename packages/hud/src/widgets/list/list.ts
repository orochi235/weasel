import type { DrawCommand } from '@weasel-js/core/renderer';
import { LIST_ROLES, fixedWidth, listMode, measureRowList, rowAtY, type ListMode, type RowListLayout } from '@weasel-js/ui-logic';
import { createEmitter } from '@weasel-js/registry';
import { resolveTheme, weaselTheme, type ResolvedTheme } from '@weasel-js/theme';
import { createRevision } from '../../widget';
import type {
  HudAccessibleNode, HudAccessibleTree, HudDrawCtx, HudKeyEvent, HudPointerEvent, Widget, WidgetBounds,
} from '../../widget';
import { hudMeasureEnv } from '../../measureEnv';
import { DEFAULT_FONT_FAMILY } from '../../fonts/registerDefaultFont';
import { hudList, SWATCH_SIZE, type HudListRow } from './drawList';
import { createListNav } from './listNav';

/** Options for a list widget. */
export interface ListOptions {
  id: string;
  x: number; y: number; w: number;
  /** Default: as tall as its rows, measured again whenever they or the theme change. */
  h?: number;
  rows: readonly HudListRow[];
  /** Shown in place of the rows when there are none. */
  empty?: string;
  /** Whether rows are selectable, and how many at once. As with ui's `ItemList`, the list announces `selected`;
   *  what is selected stays with `onActivate`. */
  selection?: 'single' | 'multi';
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
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  /** The row the keyboard is on. */
  readonly active: number | null;
  dispose(): void;
}

let builtIn: ResolvedTheme | null = null;

/** A list's rows as its assistive tech tree: the container and row roles its mode gives, the keyboard's row active. */
function listTree(
  opts: ListOptions, mode: ListMode, rows: readonly HudListRow[], active: number | null,
): HudAccessibleNode {
  const roles = LIST_ROLES[mode];
  const selects = opts.selection !== undefined && mode !== 'list';
  return {
    role: roles.container, key: 'list', label: opts.accessibleName ?? opts.id,
    ...(opts.selection === 'multi' && selects ? { multiselectable: true } : {}),
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
  const mode = listMode({ selection: opts.selection, activatable: opts.onActivate !== undefined });
  let disposed = false;
  let hidden = false;
  let rows: readonly HudListRow[] = [];
  let lastCtx: Pick<HudDrawCtx, 'tokens' | 'defaultFont'> | null = null;
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h ?? 0 };
  const nav = createListNav(() => rows, mode, (i) => opts.onActivate?.(rows[i]!.id, i));

  const changed = () => { rev.changed(); subs.emit(); };
  const assertLive = () => { if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.'); };
  const measure = (): RowListLayout & { height: number } => {
    const ctx = lastCtx ?? { tokens: (builtIn ??= resolveTheme(weaselTheme)), defaultFont: DEFAULT_FONT_FAMILY };
    const m = measureRowList(
      { rows, empty: opts.empty }, fixedWidth(bounds.w),
      hudMeasureEnv(ctx, opts.fontFamily),
    );
    return { ...m.layout, height: m.height };
  };
  /** Follow the rows' height, when the caller gave none. True when it moved. */
  const fit = (): boolean => {
    if (opts.h !== undefined) return false;
    const h = measure().height;
    if (h === bounds.h) return false;
    bounds = { ...bounds, h };
    return true;
  };
  const setRowsInner = (next: readonly HudListRow[]) => {
    rows = next.map((r) => (r.swatch !== undefined ? { ...r, leadingWidth: SWATCH_SIZE } : r));
    nav.clamp();
    fit();
  };
  setRowsInner(opts.rows);
  const rowAt = (x: number, y: number): number | null =>
    (x < bounds.x || x >= bounds.x + bounds.w ? null : rowAtY(measure(), y - bounds.y));
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
    focusable: mode !== 'list',
    focusRing: false,
    ...(opts.tabOrder !== undefined ? { tabOrder: opts.tabOrder } : {}),
    accessibleName: opts.accessibleName ?? opts.id,
    accessibleTree: tree,
    setRows(next) { assertLive(); setRowsInner(next); changed(); },
    setBounds(b) { assertLive(); bounds = { ...b }; fit(); changed(); },
    setHidden(h) { assertLive(); hidden = h; changed(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      if (lastCtx?.tokens !== ctx.tokens || lastCtx.defaultFont !== ctx.defaultFont) {
        lastCtx = { tokens: ctx.tokens, defaultFont: ctx.defaultFont };
        // A theme with taller rows: the new height lands on the next frame.
        if (fit()) changed();
      }
      return hudList.draw(
        { rows, empty: opts.empty, mode, active: nav.active, hover: nav.hover, ring: nav.ring },
        { bounds, ctx, fontFamily: opts.fontFamily },
      );
    },
    hitTest(x, y) {
      return !hidden && x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
    },
    cursorAt() { return 'default'; },
    onPointer(evt: HudPointerEvent) { if (nav.pointer(evt, rowAt)) changed(); },
    onKey(evt: HudKeyEvent): boolean {
      const r = nav.key(evt);
      if (r.changed) changed();
      return r.handled;
    },
    onFocusChange(f: boolean) { if (nav.focus(f)) changed(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      subs = createEmitter();
      opts.removeFromHud?.();
    },
  };
}
