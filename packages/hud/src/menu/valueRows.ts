import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, textCommandFromRuns } from '@weasel-js/core';
import { menuNumberCanStep, menuNumberText, type MenuColorEntry, type MenuEntry, type MenuNumberEntry } from '@weasel-js/menu';
import type { WidgetBounds } from '../widget';
import type { MenuMetrics } from './drawPanel';
import { selectionOf, type HudTextEdit } from './textEdit';

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

/** A text row's value at the row's end, muted while disabled. */
export function textCommands(
  b: WidgetBounds, r: { y: number; h: number }, value: string | undefined, m: MenuMetrics, ink: ValueInk,
  mode: 'off' | 'live' = 'live',
): DrawCommand[] {
  return [textCommandFromRuns(
    b.x + m.padX, b.y + r.y, [{ text: value ?? '—', fill: solid(mode === 'off' ? ink.muted : ink.fg) }],
    { ...ink.font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2,
  )];
}

/** A text row being typed into: what is typed at the row's end, the selection behind it in `selection`, and a caret
 *  where `edit` has it. `measure` gives the width of a run of the row's text. */
export function typingCommands(
  b: WidgetBounds, r: { y: number; h: number }, edit: HudTextEdit, m: MenuMetrics, ink: ValueInk, selection: string,
  measure: (text: string) => number,
): DrawCommand[] {
  // Room after the last character, so a caret at the end clears it.
  const right = b.x + b.w - m.padX - 3;
  const chars = Array.from(edit.draft);
  const xAt = (i: number) => right - measure(chars.slice(i).join(''));
  const half = ink.font.fontSize * 0.6;
  const cy = b.y + r.y + r.h / 2;
  const out: DrawCommand[] = [];
  const [from, to] = selectionOf(edit);
  if (from !== to) {
    out.push({
      kind: 'path', path: { kind: 'rect', x: xAt(from), y: cy - half, width: xAt(to) - xAt(from), height: half * 2 },
      fill: solid(selection),
    });
  }
  out.push(textCommandFromRuns(
    b.x + m.padX, b.y + r.y, [{ text: edit.draft, fill: solid(ink.fg) }],
    { ...ink.font, align: 'right' }, undefined, r.h, 'center', undefined, right - b.x - m.padX,
  ));
  const x = xAt(edit.caret) + 1;
  out.push(mark(`M ${x} ${cy - half} L ${x} ${cy + half}`, ink.fg));
  return out;
}

/** A swatch of `color` in a row's icon column, outlined in `edge`; `width` 2 marks the color a picker holds. */
export function swatchCommand(
  b: WidgetBounds, r: { y: number; h: number }, color: string, m: MenuMetrics, edge: string, width = 1,
): DrawCommand {
  const size = 12;
  const x = b.x + m.padX + (m.rowHeight - size) / 2;
  const y = b.y + r.y + (r.h - size) / 2;
  return {
    kind: 'path', path: { kind: 'rect', x, y, width: size, height: size },
    fill: solid(color), stroke: { paint: { kind: 'solid', color: edge }, width },
  };
}

/** The swatch a color row draws in its icon column, and its hex at the row's end. */
export function colorCommands(
  b: WidgetBounds, r: { y: number; h: number }, e: MenuColorEntry, m: MenuMetrics, ink: ValueInk,
): DrawCommand[] {
  const out: DrawCommand[] = e.value === undefined ? [] : [swatchCommand(b, r, e.value, m, ink.border)];
  out.push(textCommandFromRuns(
    b.x + m.padX, b.y + r.y, [{ text: e.value ?? '—', fill: solid(ink.muted) }],
    { ...ink.font, align: 'right' }, undefined, r.h, 'center', undefined, b.w - m.padX * 2,
  ));
  return out;
}
