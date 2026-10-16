import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, textCommandFromRuns } from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';
import { resolveCurrentColor } from '@weasel-js/theme';
import type { HudDrawCtx, WidgetBounds } from '../widget';

/** Sizes of a HUD menu panel, in CSS pixels. */
export interface MenuMetrics {
  rowHeight: number;
  padX: number;
  padY: number;
  separatorHeight: number;
  minWidth: number;
  fontSize: number;
}

/** The metrics a menu widget uses when given none, close to the DOM menu's. */
export const DEFAULT_MENU_METRICS: MenuMetrics = {
  rowHeight: 24, padX: 8, padY: 4, separatorHeight: 9, minWidth: 180, fontSize: 13,
};

/** Each entry's y offset and height inside a panel. */
export function rowLayout(entries: readonly MenuEntry[], m: MenuMetrics): { y: number; h: number }[] {
  let y = m.padY;
  return entries.map((e) => {
    const h = e.kind === 'separator' ? m.separatorHeight : m.rowHeight;
    const row = { y, h };
    y += h;
    return row;
  });
}

/** A panel's size: its widest label plus the icon and caret columns, never under `minWidth`. */
export function panelSize(
  entries: readonly MenuEntry[], m: MenuMetrics, measure: (text: string, fontSize: number) => number,
): { w: number; h: number } {
  const rows = rowLayout(entries, m);
  const last = rows.at(-1);
  const text = Math.max(0, ...entries.map((e) => (e.kind === 'separator' ? 0 : measure(e.label, m.fontSize))));
  return {
    w: Math.max(m.minWidth, Math.ceil(text) + m.padX * 2 + m.rowHeight * 2),
    h: (last ? last.y + last.h : 0) + m.padY,
  };
}

const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });
const rect = (x: number, y: number, width: number, height: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width, height }, fill: solid(color),
});

/** A right-pointing chevron centered on (cx, cy). The bundled atlas has no `›` glyph. */
function caret(cx: number, cy: number, color: string): DrawCommand {
  const s = 3;
  return {
    kind: 'path',
    path: pathFromD(`M ${cx - s / 2} ${cy - s} L ${cx + s / 2} ${cy} L ${cx - s / 2} ${cy + s}`),
    stroke: { paint: { kind: 'solid', color }, width: 1.5, cap: 'round' },
  };
}

/** One panel's commands: its background, a highlight behind row `highlight`, and every row. */
export function drawPanel(
  ctx: HudDrawCtx, b: WidgetBounds, entries: readonly MenuEntry[], highlight: number | null, m: MenuMetrics,
): DrawCommand[] {
  const t = ctx.tokens;
  const fg = t['--wzl-fg'];
  const muted = resolveCurrentColor(t['--wzl-fg-muted'], fg);
  const out: DrawCommand[] = [{
    kind: 'path',
    path: { kind: 'rect', x: b.x, y: b.y, width: b.w, height: b.h },
    fill: solid(t['--wzl-surface-popover']),
    stroke: { paint: { kind: 'solid', color: t['--wzl-border'] }, width: 1 },
  }];
  const rows = rowLayout(entries, m);
  entries.forEach((e, i) => {
    const r = rows[i]!;
    if (e.kind === 'separator') {
      out.push(rect(b.x + m.padX, b.y + r.y + Math.floor(r.h / 2), b.w - m.padX * 2, 1, t['--wzl-border']));
      return;
    }
    if (i === highlight) out.push(rect(b.x + 2, b.y + r.y, b.w - 4, r.h, t['--wzl-surface-hover']));
    const color = e.disabled ? muted : fg;
    out.push(textCommandFromRuns(
      b.x + m.padX + m.rowHeight, b.y + r.y,
      [{ text: e.label, fill: solid(color) }],
      { fontFamily: ctx.defaultFont, fontSize: m.fontSize },
      undefined, r.h, 'center',
    ));
    if (e.kind === 'submenu') out.push(caret(b.x + b.w - m.padX - m.rowHeight / 2, b.y + r.y + r.h / 2, color));
  });
  return out;
}

/** Index of the entry under panel-local `y`, or null. */
export function rowAt(entries: readonly MenuEntry[], m: MenuMetrics, y: number): number | null {
  const i = rowLayout(entries, m).findIndex((r) => y >= r.y && y < r.y + r.h);
  return i < 0 ? null : i;
}
