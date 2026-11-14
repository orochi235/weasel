import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, textCommandFromRuns } from '@weasel-js/core';
import { roundRectPath } from '@weasel-js/geom';
import {
  MENU_CARET_SIZE, UNBOUNDED, exactly, measureMenuPanel, menuPanelMetrics, menuRowAtY, menuRowSpans,
  type Constraints, type MeasureEnv, type Measured, type MenuPanelFace, type MenuPanelLayout, type MenuPanelMetrics,
  type MenuRowFace,
} from '@weasel-js/ui-logic';
import { formatShortcut } from '@weasel-js/gestures';
import type { MenuEntry, MenuNumberEntry, MenuTextEntry } from '@weasel-js/menu';
import { expandVars, GRADE_TOKENS, parseBoxShadow, resolveCurrentColor, tokenPx } from '@weasel-js/theme';
import { toIconSpec, type IconRegistry } from '@weasel-js/icons';
import { boxShadowCommands } from '../boxShadow';
import { iconCommands } from '../glyph';
import type { HudDrawCtx, WidgetBounds } from '../widget';
import { colorCommands, numberCommands, swatchCommand, textCommands, typingCommands, valueRowWidth } from './valueRows';
import { measureLabel } from './measureLabel';
import { menuMeasureEnv } from './menuEnv';
import type { HudTextEdit } from './textEdit';

/** A row's shortcut as the DOM menu prints it, or undefined. */
const shortcutOf = (e: MenuEntry): string | undefined => {
  if (e.kind !== 'item') return undefined;
  return typeof e.shortcut === 'string' ? e.shortcut : formatShortcut(e.shortcut);
};

/** `entries` as `measureMenuPanel` reads them: each row's label, and its trailing column, which is a value row's
 *  value, a shortcut, or a submenu's caret. `measure` gives the width of a run of a row's text. */
export function menuFace(
  entries: readonly MenuEntry[], m: MenuPanelMetrics, measure: (text: string) => number,
): MenuPanelFace {
  return {
    rows: entries.map((e): MenuRowFace => {
      if (e.kind === 'separator') return { kind: 'separator' };
      const trailing = valueRowWidth(e, m, measure) ?? shortcutOf(e) ?? (e.kind === 'submenu' ? MENU_CARET_SIZE : undefined);
      return { kind: 'row', label: e.label, ...(trailing !== undefined ? { trailing } : {}) };
    }),
  };
}

/** A panel of `entries` at its own size, measured in `env`, or held to `c`. */
export function measurePanel(
  entries: readonly MenuEntry[], env: MeasureEnv, c: Constraints = UNBOUNDED,
): Measured<MenuPanelLayout> {
  const m = menuPanelMetrics(env);
  return measureMenuPanel(menuFace(entries, m, (t) => env.text(t, m.font).width), c, env);
}

/** A panel's size, as {@link measurePanel} gives it. */
export function panelSize(entries: readonly MenuEntry[], env: MeasureEnv): { w: number; h: number } {
  const box = measurePanel(entries, env);
  return { w: box.width, h: box.height };
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

/** Where a menu finds the glyph a row's `icon` names: an icon registry, or anything answering as one. */
export type MenuIcons = Pick<IconRegistry, 'get' | 'getVersion'>;

// The shadow `.surface` in ui's listbox.module.css gives the DOM panel.
const PANEL_SHADOW = 'var(--wzl-bevel-raised, 0 8px 24px var(--wzl-shadow))';

/** What a panel's value rows hold now, and the text row being typed into. */
export interface MenuDrawValues {
  number(e: MenuNumberEntry): number | undefined;
  text(e: MenuTextEntry): string | undefined;
  editing?: HudTextEdit | null;
  /** The color a row draws as a swatch in its icon column, in place of its icon or check. */
  swatch?(e: MenuEntry): string | undefined;
  /** Width of a label, which places the caret in typed text. Defaults to {@link measureLabel}. */
  measure?(text: string, fontSize: number, fontFamily: string): number;
  /** The locale a number row's value is written in. Defaults to `en-US`. */
  locale?: string;
}

/** Each value row as it opened, with nothing being typed. */
export const OPENED_VALUES: MenuDrawValues = { number: (e) => e.value, text: (e) => e.value };

/** One panel's commands: its rounded face and the DOM panel's box shadow, a highlight behind row
 *  `highlight`, and every row, with the glyph `icons` holds for each row's icon. Rows sit where `layout` puts
 *  them, by default where {@link measurePanel} does in `b`. A value row shows what `values` says it holds, by
 *  default what it opened with. */
export function drawPanel(
  ctx: HudDrawCtx, b: WidgetBounds, entries: readonly MenuEntry[], highlight: number | null,
  icons?: MenuIcons, values: MenuDrawValues = OPENED_VALUES, layout?: MenuPanelLayout,
): DrawCommand[] {
  const t = ctx.tokens;
  const fg = t['--wzl-fg'];
  const muted = resolveCurrentColor(t['--wzl-fg-muted'], fg);
  const radius = tokenPx('--wzl-radius-md', t);
  const measure = values.measure ?? measureLabel;
  const { rows, metrics: m } = layout ?? measurePanel(
    entries, menuMeasureEnv(t, ctx.defaultFont, (s, size) => measure(s, size, ctx.defaultFont)), exactly(b.w, b.h),
  ).layout;
  const font = { fontFamily: ctx.defaultFont, fontSize: m.font.size };
  const shadow = boxShadowCommands(b, radius, parseBoxShadow(expandVars(PANEL_SHADOW, t)), fg,
    { x: b.x + 1, y: b.y + 1, w: b.w - 2, h: b.h - 2 });
  const out: DrawCommand[] = [...shadow.under, {
    kind: 'path',
    path: roundRectPath(b.x, b.y, b.w, b.h, radius),
    fill: solid(t['--wzl-surface-popover']),
    stroke: { paint: { kind: 'solid', color: t['--wzl-border'] }, width: 1 },
  }, ...shadow.over];
  const selection = t['--wzl-accent-soft'] ?? t['--wzl-surface-pressed'] ?? muted;
  const rowRadius = tokenPx('--wzl-radius-sm', t);
  entries.forEach((e, i) => {
    const box = rows[i]!;
    if (box.kind === 'separator' || e.kind === 'separator') {
      if (box.kind === 'separator') out.push(rect(b.x + box.line.x, b.y + box.line.y, box.line.width, 1, t['--wzl-border']));
      return;
    }
    const r = { y: box.rect.y, h: box.rect.height };
    if (i === highlight) {
      out.push({
        kind: 'path', path: roundRectPath(b.x + box.rect.x, b.y + r.y, box.rect.width, r.h, rowRadius),
        fill: solid(t['--wzl-surface-hover']),
      });
    }
    // A color row left a color row is one nothing writes (the widget makes the rest pickers), so it reads as disabled.
    const color = e.disabled || e.kind === 'color' ? muted : gradedInk(e, t) ?? fg;
    out.push(textCommandFromRuns(
      b.x + box.label.x, b.y + r.y,
      [{ text: e.label, fill: solid(color) }],
      font, undefined, r.h, 'center',
    ));
    const iconX = b.x + box.icon.x + box.icon.width / 2;
    const iconY = b.y + r.y + r.h / 2;
    const spec = e.kind !== 'color' ? toIconSpec(e.icon) : undefined;
    const swatch = values.swatch?.(e);
    if (swatch !== undefined) {
      const held = e.kind === 'item' && e.checked;
      out.push(swatchCommand(b, r, swatch, m, held ? fg : t['--wzl-border'], held ? 2 : 1));
    } else if (e.kind === 'item' && e.checked) out.push(check(iconX, iconY, color));
    else if (spec && icons) out.push(...iconCommands(icons, spec, { x: b.x + box.icon.x, y: b.y + box.icon.y, size: box.icon.width, color }));
    const chip = shortcutOf(e);
    if (chip) {
      out.push(textCommandFromRuns(
        b.x + m.padX, b.y + r.y, [{ text: chip, fill: solid(muted) }],
        { ...font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2,
      ));
    }
    const ink = { fg, muted, border: t['--wzl-border'], font };
    if (e.kind === 'number') out.push(...numberCommands(b, r, e, values.number(e), m, ink, values.locale));
    if (e.kind === 'color') out.push(...colorCommands(b, r, e, m, ink));
    if (e.kind === 'text') {
      const edit = values.editing?.entry === e ? values.editing : undefined;
      out.push(...(edit
        ? typingCommands(b, r, edit, m, ink, selection, (s) => measure(s, m.font.size, ctx.defaultFont))
        : textCommands(b, r, values.text(e), m, ink, e.disabled ? 'off' : 'live')));
    }
    const end = box.trailing;
    if (e.kind === 'submenu' && end) out.push(caret(b.x + end.x + end.width / 2, b.y + r.y + r.h / 2, color));
  });
  return out;
}

/** The color a graded item or submenu row draws its label and icon in, when the theme has its grade's token. */
function gradedInk(e: MenuEntry, t: HudDrawCtx['tokens']): string | undefined {
  const grade = e.kind === 'item' || e.kind === 'submenu' ? e.grade : undefined;
  return grade ? (t as Readonly<Record<string, string | undefined>>)[GRADE_TOKENS[grade]] : undefined;
}

/** Index of the entry under panel-local `y`, or null. */
export function rowAt(entries: readonly MenuEntry[], m: MenuPanelMetrics, y: number): number | null {
  return menuRowAtY(menuRowSpans(entries, m), y);
}
