import type { Rect } from '@weasel-js/geom';
import {
  centeredBaseline, clampTo, envNumber, envPx,
  type Constraints, type FontSpec, type MeasureEnv, type Measured,
} from './measure';

/** What a row list can do, which decides its semantics: nothing (`list`), select (`listbox`), or hold controls in
 *  its rows (`grid`, since an option may not contain interactive content). */
export type ListMode = 'list' | 'listbox' | 'grid';

/** What decides a row list's {@link ListMode}. */
export interface ListModeInput {
  /** Rows are selectable, one or many at once. */
  readonly selection?: 'single' | 'multi';
  /** Rows answer a press. */
  readonly activatable?: boolean;
  /** Some row holds controls of its own. */
  readonly controls?: boolean;
}

/** A row list's mode: `grid` when a row holds controls or rows activate without selecting, else `listbox` when
 *  they select, else `list`. */
export function listMode(o: ListModeInput): ListMode {
  if (o.controls || (o.activatable && !o.selection)) return 'grid';
  return o.selection ? 'listbox' : 'list';
}

/** The ARIA roles of a row list's container and its rows, by mode. */
export const LIST_ROLES: Readonly<Record<ListMode, { readonly container: string; readonly row: string }>> = {
  list: { container: 'list', row: 'listitem' },
  listbox: { container: 'listbox', row: 'option' },
  grid: { container: 'grid', row: 'row' },
};

/** Which edge of row `i` of `count` carries the seam for a drop at gap `dropIndex`, if either. */
export function dropSide(dropIndex: number | null | undefined, i: number, count: number): 'before' | 'after' | undefined {
  if (dropIndex == null) return undefined;
  if (dropIndex === i) return 'before';
  if (dropIndex >= count && i === count - 1) return 'after';
  return undefined;
}

/** One row as measuring reads it. The leading decoration and the trailing controls are measured by their width. */
export interface RowFace {
  readonly id: string;
  readonly label: string;
  readonly leadingWidth?: number;
  readonly trailingWidth?: number;
}

/** A row list as measuring reads it. */
export interface RowListFace {
  readonly rows: readonly RowFace[];
  /** Shown in place of the rows when there are none. Default an em dash, as ui's `ItemList` shows. */
  readonly empty?: string;
}

/** Space between adjacent rows: ui's `ItemList.module.css` `.list { gap: 1px }`. */
export const ROW_GAP = 1;

/** A row list's sizes in px, read from its theme. */
export interface RowListMetrics {
  readonly rowHeight: number;
  readonly padX: number;
  /** Between a row's leading decoration, its label, and its controls. */
  readonly gap: number;
  /** The empty state's inset from top and bottom. */
  readonly emptyPadY: number;
  readonly font: FontSpec;
  /** A line of text's height: the font size times `--wzl-leading-snug`, which `.list` sets. */
  readonly lineHeight: number;
}

/** The tokens a row list is sized by: the ones `ItemList.module.css` lays it out with. */
export function rowListMetrics(env: MeasureEnv): RowListMetrics {
  const size = envPx(env, '--wzl-font-size-sm');
  return {
    rowHeight: envPx(env, '--wzl-control-h'),
    padX: envPx(env, '--wzl-space-4'),
    gap: envPx(env, '--wzl-space-4'),
    emptyPadY: envPx(env, '--wzl-space-6'),
    font: { family: env.token('--wzl-font-ui'), size, weight: 400 },
    lineHeight: size * envNumber(env, '--wzl-leading-snug', 1.2),
  };
}

/** Where one row and its parts sit, relative to the list's top left. The label fills what the leading
 *  decoration and the controls leave. */
export interface RowBox {
  readonly id: string;
  readonly rect: Rect;
  readonly leading?: Rect;
  readonly label: Rect;
  readonly trailing?: Rect;
}

/** Where a row list's rows sit, or its empty state when it has none. */
export interface RowListLayout {
  readonly rows: readonly RowBox[];
  readonly empty?: Rect;
  readonly metrics: RowListMetrics;
}

/**
 * A row list's box: rows a control height tall, {@link ROW_GAP} apart, as wide as the widest row's leading, label
 * and controls with their gaps and padding, held to `c`. A list stretched to its column passes that width as both
 * bounds. With no rows it is the empty state's line, padded.
 */
export function measureRowList(face: RowListFace, c: Constraints, env: MeasureEnv): Measured<RowListLayout> {
  const m = rowListMetrics(env);
  if (face.rows.length === 0) {
    const t = env.text(face.empty ?? '—', m.font);
    const line = m.lineHeight;
    const width = clampTo(t.width + m.padX * 2, c.minWidth, c.maxWidth);
    const height = clampTo(line + m.emptyPadY * 2, c.minHeight, c.maxHeight);
    const empty = { x: m.padX, y: m.emptyPadY, width: Math.max(0, width - m.padX * 2), height: line };
    return { width, height, baseline: m.emptyPadY + centeredBaseline(line, line, t), layout: { rows: [], empty, metrics: m } };
  }

  const extents = face.rows.map((r) => env.text(r.label, m.font));
  const side = (r: RowFace) => (r.leadingWidth != null ? r.leadingWidth + m.gap : 0)
    + (r.trailingWidth != null ? r.trailingWidth + m.gap : 0);
  const intrinsic = Math.max(...face.rows.map((r, i) => m.padX * 2 + side(r) + extents[i]!.width));
  const width = clampTo(intrinsic, c.minWidth, c.maxWidth);
  const n = face.rows.length;
  const height = clampTo(n * m.rowHeight + (n - 1) * ROW_GAP, c.minHeight, c.maxHeight);

  const rows = face.rows.map((r, i): RowBox => {
    const y = i * (m.rowHeight + ROW_GAP);
    const h = m.rowHeight;
    const line = m.lineHeight;
    let x = m.padX;
    let right = width - m.padX;
    const box = { x: 0, y, width, height: h };
    const leading = r.leadingWidth != null ? { x, y, width: r.leadingWidth, height: h } : undefined;
    if (leading) x += r.leadingWidth! + m.gap;
    const trailing = r.trailingWidth != null ? { x: right - r.trailingWidth, y, width: r.trailingWidth, height: h } : undefined;
    if (trailing) right -= r.trailingWidth! + m.gap;
    const label = { x, y: y + (h - line) / 2, width: Math.max(0, right - x), height: line };
    return { id: r.id, rect: box, label, ...(leading ? { leading } : {}), ...(trailing ? { trailing } : {}) };
  });
  const baseline = centeredBaseline(m.rowHeight, m.lineHeight, extents[0]!);
  return { width, height, baseline, layout: { rows, metrics: m } };
}

/** Index of the row under list-local `y`, or null between rows and past either end. */
export function rowAtY(layout: RowListLayout, y: number): number | null {
  const i = layout.rows.findIndex((r) => y >= r.rect.y && y < r.rect.y + r.rect.height);
  return i < 0 ? null : i;
}
