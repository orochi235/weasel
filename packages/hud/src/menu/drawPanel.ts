import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, textCommandFromRuns } from '@weasel-js/core';
import { roundRectPath } from '@weasel-js/geom';
import { formatShortcut } from '@weasel-js/gestures';
import type { MenuEntry } from '@weasel-js/menu';
import { resolveCurrentColor, tokenPx } from '@weasel-js/theme';
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

/** A row's shortcut as the DOM menu prints it, or undefined. */
const shortcutOf = (e: MenuEntry): string | undefined =>
  (e.kind === 'item' ? formatShortcut(e.shortcut) : undefined);

/** A panel's size: its widest row — label, then a shortcut or the caret column —
 *  plus the icon column, never under `minWidth`. */
export function panelSize(
  entries: readonly MenuEntry[], m: MenuMetrics, measure: (text: string, fontSize: number) => number,
): { w: number; h: number } {
  const rows = rowLayout(entries, m);
  const last = rows.at(-1);
  const rowWidth = (e: MenuEntry) => {
    if (e.kind === 'separator') return 0;
    const chip = shortcutOf(e);
    return measure(e.label, m.fontSize) + Math.max(m.rowHeight, chip ? m.padX + measure(chip, m.fontSize) : 0);
  };
  const text = Math.max(0, ...entries.map(rowWidth));
  return {
    w: Math.max(m.minWidth, Math.ceil(text) + m.padX * 2 + m.rowHeight),
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

/** A check mark centered on (cx, cy), for a row whose action is on. */
function check(cx: number, cy: number, color: string): DrawCommand {
  return {
    kind: 'path',
    path: pathFromD(`M ${cx - 4} ${cy} L ${cx - 1.5} ${cy + 2.5} L ${cx + 4} ${cy - 3}`),
    stroke: { paint: { kind: 'solid', color }, width: 1.5, cap: 'round', join: 'round' },
  };
}

// The DOM panel's own shadow, `0 8px 24px var(--wzl-shadow)`: a blur that
// reaches SHADOW_BLUR / 2 either side of the edge, drawn as nested rounded
// rects whose overlap builds the falloff.
const SHADOW_DY = 8;
const SHADOW_BLUR = 24;
const SHADOW_STEP = 4;
const SHADOW_LAYER_ALPHA = 0.16;

function shadow(b: WidgetBounds, radius: number, color: string): DrawCommand {
  const children: DrawCommand[] = [];
  for (let e = SHADOW_BLUR / 2; e >= -SHADOW_BLUR / 2; e -= SHADOW_STEP) {
    const w = b.w + e * 2;
    const h = b.h + e * 2;
    if (w <= 0 || h <= 0) continue;
    children.push({
      kind: 'path',
      path: roundRectPath(b.x - e, b.y + SHADOW_DY - e, w, h, Math.max(0, radius + e)),
      fill: solid(color),
    });
  }
  return { kind: 'group', alpha: SHADOW_LAYER_ALPHA, children };
}

/** One panel's commands: its shadow and rounded background, a highlight behind row `highlight`, and every row. */
export function drawPanel(
  ctx: HudDrawCtx, b: WidgetBounds, entries: readonly MenuEntry[], highlight: number | null, m: MenuMetrics,
): DrawCommand[] {
  const t = ctx.tokens;
  const fg = t['--wzl-fg'];
  const muted = resolveCurrentColor(t['--wzl-fg-muted'], fg);
  const radius = tokenPx('--wzl-radius-md', t);
  const font = { fontFamily: ctx.defaultFont, fontSize: m.fontSize };
  const out: DrawCommand[] = [shadow(b, radius, t['--wzl-shadow']), {
    kind: 'path',
    path: roundRectPath(b.x, b.y, b.w, b.h, radius),
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
      font, undefined, r.h, 'center',
    ));
    if (e.kind === 'item' && e.checked) out.push(check(b.x + m.padX + m.rowHeight / 2, b.y + r.y + r.h / 2, color));
    const chip = shortcutOf(e);
    if (chip) {
      out.push(textCommandFromRuns(
        b.x + m.padX, b.y + r.y, [{ text: chip, fill: solid(muted) }],
        { ...font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2,
      ));
    }
    if (e.kind === 'submenu') out.push(caret(b.x + b.w - m.padX - m.rowHeight / 2, b.y + r.y + r.h / 2, color));
  });
  return out;
}

/** Index of the entry under panel-local `y`, or null. */
export function rowAt(entries: readonly MenuEntry[], m: MenuMetrics, y: number): number | null {
  const i = rowLayout(entries, m).findIndex((r) => y >= r.y && y < r.y + r.h);
  return i < 0 ? null : i;
}
