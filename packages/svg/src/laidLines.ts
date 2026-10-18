/**
 * The body of a `<text>` from the lines the renderer laid it out into: each
 * line a `<tspan>` placed at the layout's own `x` and baseline `y`, so a
 * reader that cannot wrap, justify, or pitch a line around a larger run still
 * draws the lines where weasel does. A line the layout justified also gives
 * every word its own `x`, since `text-anchor` has no justify.
 */
import type { LaidOutCell, LaidOutLineBox, TextPoseLayout } from '@weasel-js/core';
import { LINES_ATTR, type LinePiece } from './tspanLines';
import { trimNumber } from './transform';
import { escapeText } from './xmlEscape';

/** The `<text>` attribute saying its lines were written from a layout. */
export const LAID_ATTR = 'data-weasel-layout';

/** Which point of a chunk its `x` names, as `text-anchor` reads it. */
export interface ChunkAnchor { anchor: 'start' | 'middle' | 'end'; rtl: boolean }

/** Whether `layout` placed anything: with no face able to measure the text it
 *  lays out to zero width, and its positions say nothing. */
export function layoutMeasured(layout: TextPoseLayout, text: string): boolean {
  return layout.laid.bounds.width > 0 || text.trim() === '';
}

function anchorX(cells: readonly LaidOutCell[], { anchor, rtl }: ChunkAnchor): number {
  const left = Math.min(...cells.map((c) => c.x));
  const right = Math.max(...cells.map((c) => c.x + c.advance));
  if (anchor === 'middle') return (left + right) / 2;
  return (anchor === 'start') === !rtl ? left : right;
}

/** Where each word starts in `[start, end)` of `text`: after a run of spaces. */
function wordStarts(text: string, start: number, end: number): number[] {
  const out = [start];
  for (let i = start + 1; i < end; i++) {
    if (!/\s/.test(text[i]) && /\s/.test(text[i - 1])) out.push(i);
  }
  return out;
}

/** The pieces' text in `[start, end)`, the first tspan carrying `lead`. */
function rangeXml(
  pieces: readonly LinePiece[], offsets: readonly number[], start: number, end: number, lead: string[],
): string {
  let out = '';
  let first = true;
  pieces.forEach((piece, k) => {
    const from = Math.max(start, offsets[k]);
    const to = Math.min(end, offsets[k] + piece.text.length);
    if (from >= to) return;
    const text = piece.text.slice(from - offsets[k], to - offsets[k]);
    const attrs = [...(piece.attrs ?? []), ...(first ? lead : [])];
    first = false;
    out += piece.attrs === null && attrs.length === 0
      ? escapeText(text)
      : `<tspan${attrs.map((a) => ` ${a}`).join('')}>${escapeText(text)}</tspan>`;
  });
  return out;
}

/** UAX #14's hard breaks, a CR LF pair counted once. */
const HARD_BREAKS = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g;
const breaksIn = (text: string): number => text.match(HARD_BREAKS)?.length ?? 0;

/**
 * Write `pieces` as `layout` broke them. A line the layout wrapped onto says
 * it steps down `0` lines, so weasel's reader joins it back into its
 * paragraph. Blank lines are not written: the next line's count covers them,
 * as `linesXml` folds them.
 */
export function laidLinesXml(
  pieces: readonly LinePiece[], layout: TextPoseLayout, anchor: ChunkAnchor,
): string {
  const text = pieces.map((p) => p.text).join('');
  const offsets: number[] = [];
  pieces.reduce((at, p) => { offsets.push(at); return at + p.text.length; }, 0);
  const px = (x: number) => `x="${trimNumber(layout.x + x)}"`;
  const py = (line: LaidOutLineBox) => `y="${trimNumber(layout.y + line.baselineY)}"`;
  let out = '';
  let wrote = false;
  let prevEnd = 0;
  const count = (lines: number): string[] => {
    const stated = lines !== 1 || !wrote ? [`${LINES_ATTR}="${lines}"`] : [];
    wrote = true;
    return stated;
  };
  for (const line of layout.laid.lines) {
    if (line.cells.length === 0) continue;
    const start = Math.min(...line.cells.map((c) => c.srcIndex));
    const stepped = breaksIn(text.slice(prevEnd, start));
    prevEnd = line.srcEnd;
    const starts = line.justified ? wordStarts(text, start, line.srcEnd) : [start];
    starts.forEach((from, k) => {
      const to = starts[k + 1] ?? line.srcEnd;
      const cells = line.cells.filter((c) => c.srcIndex >= from && c.srcIndex < to);
      const lead = [px(anchorX(cells, anchor)), ...(k === 0 ? [py(line), ...count(stepped)] : [])];
      out += rangeXml(pieces, offsets, from, to, lead);
    });
  }
  const trailing = breaksIn(text.slice(prevEnd));
  const last = layout.laid.lines[layout.laid.lines.length - 1];
  if (trailing > 0 && last) out += `<tspan ${[px(last.x0), py(last), ...count(trailing)].join(' ')}></tspan>`;
  return out;
}
