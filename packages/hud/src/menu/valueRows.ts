import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, textCommandFromRuns } from '@weasel-js/core';
import { menuNumberCanStep, menuNumberText, type MenuColorEntry, type MenuEntry, type MenuNumberEntry } from '@weasel-js/menu';
import type { WidgetBounds } from '../widget';
import type { MenuMetrics } from './drawPanel';

/** A span across a panel, from its left edge. */
export interface Span { x: number; w: number }

/**
 * Where a number row's step chips and value sit, at the row's end: a minus chip, the value in a cell of fixed
 * width so a changing value moves nothing, and a plus chip. `width` is all three.
 */
export function numberChips(panelW: number, m: MenuMetrics): { minus: Span; value: Span; plus: Span; width: number } {
  const s = m.rowHeight;
  const end = panelW - m.padX;
  return { minus: { x: end - 4 * s, w: s }, value: { x: end - 3 * s, w: 2 * s }, plus: { x: end - s, w: s }, width: 4 * s };
}

/** Which way the chip under panel-local `x` steps a number row: 1, -1, or null off both. */
export function chipAt(panelW: number, m: MenuMetrics, x: number): 1 | -1 | null {
  const { minus, plus } = numberChips(panelW, m);
  const inside = (s: Span) => x >= s.x && x < s.x + s.w;
  return inside(plus) ? 1 : inside(minus) ? -1 : null;
}

/** What a value row needs past its label, for sizing the panel; undefined for any other row. */
export function valueRowWidth(e: MenuEntry, m: MenuMetrics, measure: (text: string, fontSize: number) => number): number | undefined {
  if (e.kind === 'number') return m.padX + numberChips(0, m).width;
  if (e.kind === 'color') return Math.max(m.rowHeight, m.padX + measure(e.value ?? '—', m.fontSize));
  // Room to type into, as the DOM menu's 12ch field gives.
  if (e.kind === 'text') return m.padX + Math.max(measure(e.value ?? '—', m.fontSize), m.fontSize * 7);
  return undefined;
}

const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });
const mark = (d: string, color: string): DrawCommand => ({
  kind: 'path', path: pathFromD(d), stroke: { paint: { kind: 'solid', color }, width: 1.5, cap: 'round' },
});

/** The colors and font a value row draws in. */
export interface ValueInk { fg: string; muted: string; border: string; font: { fontFamily: string; fontSize: number } }

/** A number row's chips and value. A chip with nowhere to step to is muted, as is all of a disabled row. */
export function numberCommands(
  b: WidgetBounds, r: { y: number; h: number }, e: MenuNumberEntry, value: number | undefined, m: MenuMetrics, ink: ValueInk,
): DrawCommand[] {
  const { minus, value: cell, plus } = numberChips(b.w, m);
  const cy = b.y + r.y + r.h / 2;
  const color = (live: boolean) => (live && !e.disabled ? ink.fg : ink.muted);
  const cx = (s: Span) => b.x + s.x + s.w / 2;
  const low = value !== undefined && !menuNumberCanStep(e, value, -1);
  const high = value !== undefined && !menuNumberCanStep(e, value, 1);
  return [
    mark(`M ${cx(minus) - 4} ${cy} L ${cx(minus) + 4} ${cy}`, color(!low)),
    textCommandFromRuns(
      b.x + cell.x, b.y + r.y, [{ text: menuNumberText(value, e), fill: solid(color(true)) }],
      { ...ink.font, align: 'center' }, undefined, r.h, 'center', undefined, cell.w,
    ),
    mark(`M ${cx(plus) - 4} ${cy} L ${cx(plus) + 4} ${cy} M ${cx(plus)} ${cy - 4} L ${cx(plus)} ${cy + 4}`, color(!high)),
  ];
}

/** A text row's value at the row's end: muted while disabled, and followed by a caret while it is typed into. */
export function textCommands(
  b: WidgetBounds, r: { y: number; h: number }, value: string | undefined, m: MenuMetrics, ink: ValueInk,
  mode: 'off' | 'live' | 'typing' = 'live',
): DrawCommand[] {
  const typing = mode === 'typing';
  const end = b.x + b.w - m.padX;
  const out: DrawCommand[] = [textCommandFromRuns(
    b.x + m.padX, b.y + r.y, [{ text: typing ? value ?? '' : value ?? '—', fill: solid(mode === 'off' ? ink.muted : ink.fg) }],
    { ...ink.font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2 - (typing ? 3 : 0),
  )];
  if (typing) {
    const half = ink.font.fontSize * 0.6;
    const cy = b.y + r.y + r.h / 2;
    out.push(mark(`M ${end - 1} ${cy - half} L ${end - 1} ${cy + half}`, ink.fg));
  }
  return out;
}

/** The swatch a color row draws in its icon column, and its hex at the row's end. */
export function colorCommands(
  b: WidgetBounds, r: { y: number; h: number }, e: MenuColorEntry, m: MenuMetrics, ink: ValueInk,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  if (e.value !== undefined) {
    const size = 12;
    const x = b.x + m.padX + (m.rowHeight - size) / 2;
    const y = b.y + r.y + (r.h - size) / 2;
    out.push({
      kind: 'path', path: { kind: 'rect', x, y, width: size, height: size },
      fill: solid(e.value), stroke: { paint: { kind: 'solid', color: ink.border }, width: 1 },
    });
  }
  out.push(textCommandFromRuns(
    b.x + m.padX, b.y + r.y, [{ text: e.value ?? '—', fill: solid(ink.muted) }],
    { ...ink.font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2,
  ));
  return out;
}
