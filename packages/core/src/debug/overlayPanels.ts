/** The debug overlay's text panels — the layer list and the frame stats — and the rect path every box is drawn with. */
import type { DrawCommand } from '@weasel-js/renderer';
import { textCommandFromRuns } from '@weasel-js/renderer';
import type { Dims } from 'core/layers/render';
import type { DebugSnapshot, DebugTheme, FrameStats } from './types';

export function rectPath(x: number, y: number, w: number, h: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  return { kind: 'rect', x, y, width: w, height: h };
}

/** A `DebugStroke` + color as the renderer's stroke shape. `dash` is dropped
 *  when empty rather than passed through, so a solid line stays solid. */
export function emitLayersPanel(
  out: DrawCommand[],
  s: DebugSnapshot,
  dims: Dims,
  theme: DebugTheme,
): void {
  if (s.layers.length === 0) return;
  const lineH = 14;
  const padX = 6;
  const padY = 4;
  const lines = s.layers.map((l) => `[${l.index}] ${l.id} (${l.space})`);
  // Approximate width: 11px font, monospaced — assume each glyph ≈6.6px.
  // 2D path uses ctx.measureText; we don't have a ctx here, so fall back
  // to a character-count estimate. Pixel-level accuracy is not load-bearing
  // for a debug panel; right-edge anchoring stays correct.
  const charW = 6.6;
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, line.length * charW);
  const boxW = maxW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  const x = dims.width - boxW - 8;
  const y = 8;
  out.push({
    kind: 'path',
    path: rectPath(x, y, boxW, boxH),
    fill: { paint: { kind: 'solid', color: theme.layerTextBg } },
  });
  for (let i = 0; i < lines.length; i++) {
    out.push(textCommandFromRuns(
      x + padX,
      y + padY + i * lineH,
      [{ text: lines[i], fill: { paint: { kind: 'solid', color: theme.layerText } } }],
      { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 },
    ));
  }
}

const MONO = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 };
const MONO_CHAR_W = 6.6;
export const LINE_H = 14;

/** A dark box holding monospace lines, at `(x, y)`; `y < 0` anchors its bottom
 *  that far above `bottom`. Width is estimated from the character count — there
 *  is no text measurer here, and a debug panel does not need one. */
export function emitTextPanel(
  out: DrawCommand[],
  lines: readonly string[],
  x: number,
  y: number,
  color: string,
  bg: string,
): void {
  const padX = 6;
  const padY = 4;
  let maxLen = 0;
  for (const l of lines) maxLen = Math.max(maxLen, l.length);
  out.push({
    kind: 'path',
    path: rectPath(x, y, maxLen * MONO_CHAR_W + padX * 2, lines.length * LINE_H + padY * 2),
    fill: { paint: { kind: 'solid', color: bg } },
  });
  for (let i = 0; i < lines.length; i++) {
    out.push(textCommandFromRuns(
      x + padX,
      y + padY + i * LINE_H,
      [{ text: lines[i], fill: { paint: { kind: 'solid', color } } }],
      MONO,
    ));
  }
}

/** Fixed-width number, right-aligned, `decimals` places: `%{width}.{decimals}f`. */
function fixed(v: number, width: number, decimals: number): string {
  return v.toFixed(decimals).padStart(width);
}

export function emitFramePanel(
  out: DrawCommand[],
  history: readonly number[],
  frame: FrameStats | null,
  theme: DebugTheme,
): void {
  const span = history.length >= 2 ? history[history.length - 1] - history[0] : 0;
  const interval = span > 0 ? span / (history.length - 1) : null;
  // Columns: label, draw-call count, value, unit — every row the same width,
  // so decimals line up down the panel.
  const rows: [label: string, count: number | null, value: number | null, unit: string][] = [
    ['fps', null, interval ? 1000 / interval : null, '  '],
    ['frame', null, interval, 'ms'],
  ];
  if (frame) {
    rows.push(['paint', frame.drawCalls, frame.paintMs, 'ms']);
    for (const l of frame.layers) rows.push([l.id, l.drawCalls, l.ms, 'ms']);
  }
  let labelW = 0;
  for (const [label] of rows) labelW = Math.max(labelW, label.length);
  const line = (label: string, count: string, value: string, unit: string) =>
    `${label.padEnd(labelW)} ${count.padStart(5)} ${value.padStart(7)} ${unit}`;
  const lines = rows.map(([label, count, value, unit]) =>
    line(label, count === null ? '' : String(count), value === null ? '—' : fixed(value, 7, 2), unit));
  if (frame) lines.splice(2, 0, line('', 'draws', 'cpu', '  '));
  emitTextPanel(out, lines, 8, 8, theme.fpsText, theme.fpsTextBg);
}
