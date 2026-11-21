import { clamp, maxOf, type Rect } from '@weasel-js/geom';
import {
  centeredBaseline, envNumber, envPx,
  type Constraints, type FontSpec, type MeasureEnv, type Measured,
} from './measure';

/** A menu panel's narrowest width, its border included: ui's `Menu.module.css` `.panel { min-width: 180px }`. */
export const MENU_MIN_WIDTH = 180;
/** A menu panel's border: ui's `listbox.module.css` `.surface { border: 1px solid … }`. */
export const MENU_BORDER_WIDTH = 1;
/** A row's icon column, the size its icon draws at: `.row`'s first grid track. */
export const MENU_ICON_SIZE = 16;
/** A submenu row's caret: `.caret`'s width. */
export const MENU_CARET_SIZE = 10;

/** A menu panel's sizes in px, read from its theme. */
export interface MenuPanelMetrics {
  /** Every row but a separator. */
  readonly rowHeight: number;
  /** The panel's border and padding, on every side: where a row's highlight and a separator's line start. */
  readonly inset: number;
  /** From the panel's edge to a row's content: its inset and the row's padding. */
  readonly padX: number;
  /** From the panel's edge to its first row, and from its last row: its inset. */
  readonly padY: number;
  /** Between a row's icon, label, and trailing columns. */
  readonly gap: number;
  /** Kept after a label's text, so a shortcut never sits close against it. */
  readonly labelPad: number;
  /** A separator's 1px line and the space either side of it. */
  readonly separatorHeight: number;
  readonly minWidth: number;
  readonly iconSize: number;
  readonly font: FontSpec;
  /** A current row's font: {@link font} at `--wzl-font-weight-bold`, which `.current` sets. */
  readonly currentFont: FontSpec;
  /** A line of text's height: the font size times `--wzl-leading-snug`, which `.row` sets. */
  readonly lineHeight: number;
}

/** The tokens a menu panel is sized by: the ones `Menu.module.css` lays the DOM menu out with. */
export function menuPanelMetrics(env: MeasureEnv): MenuPanelMetrics {
  const inset = MENU_BORDER_WIDTH + envPx(env, '--wzl-space-2');
  const size = envPx(env, '--wzl-font-size');
  const font = { family: env.token('--wzl-font-ui'), size, weight: 400 };
  return {
    rowHeight: envPx(env, '--wzl-control-h-sm'),
    inset,
    padX: inset + envPx(env, '--wzl-space-2'),
    padY: inset,
    gap: envPx(env, '--wzl-space-2'),
    labelPad: envPx(env, '--wzl-space-8'),
    separatorHeight: envPx(env, '--wzl-space-1') * 2 + 1,
    minWidth: MENU_MIN_WIDTH,
    iconSize: MENU_ICON_SIZE,
    font,
    currentFont: { ...font, weight: envNumber(env, '--wzl-font-weight-bold', 700) },
    lineHeight: size * envNumber(env, '--wzl-leading-snug', 1.2),
  };
}

/** One line of a menu panel as measuring reads it. A row's `trailing` is its last column: text (a shortcut) is
 *  measured in the panel's font, a number (a caret, a value field) is a width. A `current` row's label is
 *  measured bold, as the DOM draws it. */
export type MenuRowFace =
  | { readonly kind: 'separator' }
  | { readonly kind: 'row'; readonly label: string; readonly trailing?: string | number; readonly current?: boolean };

/** A menu panel as measuring reads it. */
export interface MenuPanelFace {
  readonly rows: readonly MenuRowFace[];
}

/** Where one line of a panel sits, relative to the panel's top left. `rect` spans the panel's content box, where a
 *  highlight is drawn; a separator's `line` is its 1px rule. */
export type MenuRowBox =
  | { readonly kind: 'separator'; readonly rect: Rect; readonly line: Rect }
  | { readonly kind: 'row'; readonly rect: Rect; readonly icon: Rect; readonly label: Rect; readonly trailing?: Rect };

/** Where a menu panel's rows sit. */
export interface MenuPanelLayout {
  readonly rows: readonly MenuRowBox[];
  readonly metrics: MenuPanelMetrics;
}

/** Each line's top and height inside a panel, from `kinds` alone: what hit testing a row needs. */
export function menuRowSpans(
  kinds: readonly { readonly kind: string }[], m: MenuPanelMetrics,
): { y: number; h: number }[] {
  let y = m.padY;
  return kinds.map((r) => {
    const h = r.kind === 'separator' ? m.separatorHeight : m.rowHeight;
    const span = { y, h };
    y += h;
    return span;
  });
}

/** Index of the line whose span holds panel-local `y`, or null in the padding. */
export function menuRowAtY(spans: readonly { y: number; h: number }[], y: number): number | null {
  const i = spans.findIndex((r) => y >= r.y && y < r.y + r.h);
  return i < 0 ? null : i;
}

/**
 * A menu panel's box: rows a small control tall, a separator its rule and the space around it, padded by the
 * panel's inset; as wide as its widest row's icon, label, and trailing columns with their gaps, never under
 * {@link MENU_MIN_WIDTH}, and held to `c`. Every row keeps both gaps, the DOM row being a three-track grid.
 */
export function measureMenuPanel(face: MenuPanelFace, c: Constraints, env: MeasureEnv): Measured<MenuPanelLayout> {
  const m = menuPanelMetrics(env);
  const spans = menuRowSpans(face.rows, m);
  const trailingWidth = (t: string | number | undefined) =>
    (t === undefined ? 0 : typeof t === 'number' ? t : env.text(t, m.font).width);
  const labelText = (r: { label: string; current?: boolean }) => env.text(r.label, r.current ? m.currentFont : m.font);
  const intrinsic = maxOf(face.rows, (r) => (r.kind === 'separator' ? 0
    : m.padX * 2 + m.iconSize + m.gap * 2 + labelText(r).width + m.labelPad + trailingWidth(r.trailing)));
  const width = clamp(Math.max(m.minWidth, Math.ceil(intrinsic)), c.minWidth, c.maxWidth);
  const last = spans.at(-1);
  const height = clamp((last ? last.y + last.h : m.padY) + m.padY, c.minHeight, c.maxHeight);

  const rows = face.rows.map((r, i): MenuRowBox => {
    const { y, h } = spans[i]!;
    const rect = { x: m.inset, y, width: Math.max(0, width - m.inset * 2), height: h };
    if (r.kind === 'separator') {
      return { kind: 'separator', rect, line: { x: m.inset, y: y + Math.floor(h / 2), width: rect.width, height: 1 } };
    }
    const icon = { x: m.padX, y: y + (h - m.iconSize) / 2, width: m.iconSize, height: m.iconSize };
    const tw = trailingWidth(r.trailing);
    const right = width - m.padX;
    const labelX = m.padX + m.iconSize + m.gap;
    const label = { x: labelX, y: y + (h - m.lineHeight) / 2, width: Math.max(0, right - tw - m.gap - labelX), height: m.lineHeight };
    const trailing = r.trailing === undefined ? undefined : { x: right - tw, y, width: tw, height: h };
    return { kind: 'row', rect, icon, label, ...(trailing ? { trailing } : {}) };
  });
  const first = face.rows.findIndex((r) => r.kind === 'row');
  const firstRow = face.rows[first];
  const baseline = firstRow?.kind === 'row'
    ? spans[first]!.y + centeredBaseline(m.rowHeight, m.lineHeight, labelText(firstRow))
    : height;
  return { width, height, baseline, layout: { rows, metrics: m } };
}
