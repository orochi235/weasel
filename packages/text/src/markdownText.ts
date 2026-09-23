import { resolveScreenLength } from '@weasel-js/paint';
import { markdownToRuns, type StyledRun } from './runs';
import { SCRIPT_METRICS } from './runs/resolveRuns';
import { DECORATION_KINDS, decorationRule, type DecorationKind } from './layout/decorationMetrics';
import { transformRunTexts } from './runs/textTransform';

export type { StyledRun };

/** Width-measurement strategy for `layoutMarkdown`; canvas-backed default supplied by `createMarkdownRenderer`. */
export type MeasureFn = (text: string, fontSize: number, bold: boolean, italic: boolean) => number;

/** A `StyledRun` with its resolved size and its position relative to the
 *  start of its line: `x` along the line, `y` off its baseline. */
export interface PositionedRun extends StyledRun {
  x: number;
  /** Advance width, as the layout's `MeasureFn` measured it. */
  width: number;
  /** Baseline offset, positive down — a superscript's is negative. Add it to
   *  the line's baseline when painting. */
  y: number;
  /** The run's font size in px, with `fontScale` and `script` already folded
   *  in. Resolved once here so layout and paint cannot disagree about it. */
  size: number;
}

/**
 * A run's size and baseline offset, resolved the way `resolveRuns` resolves
 * them for the GL path: an absolute `fontSize` wins over a multiplier, and
 * the rise is measured against the *inherited* size so it does not shrink
 * along with the run.
 */
function runMetrics(run: StyledRun, fontSize: number): { size: number; y: number } {
  const script = run.script ? SCRIPT_METRICS[run.script] : undefined;
  const scale = run.fontScale ?? script?.size ?? 1;
  const shiftEm = run.baselineShift ?? script?.shift ?? 0;
  return {
    size: run.fontSize !== undefined
      ? resolveScreenLength(run.fontSize, 1)
      : fontSize * scale,
    // Canvas y grows downward; a positive shift is a rise. Guarded so an
    // unshifted run reports 0 rather than -0.
    y: shiftEm === 0 ? 0 : -shiftEm * fontSize,
  };
}

/** A single laid-out line of text: its positioned runs, total width, and computed line height. */
export interface LayoutLine {
  runs: PositionedRun[];
  width: number;
  height: number;
}

/** Output of `layoutMarkdown`: per-line breakdown plus overall block dimensions. */
export interface LayoutResult {
  lines: LayoutLine[];
  width: number;
  height: number;
}

/** Word-wrap parsed runs into lines bounded by `maxWidth`; pass `Infinity` for single-line layout. */
export function layoutMarkdown(
  runs: StyledRun[],
  maxWidth: number,
  fontSize: number,
  measure: MeasureFn,
  lineHeightFactor: number = 1.3,
): LayoutResult {
  if (runs.length === 0) return { lines: [], width: 0, height: 0 };
  // No caret reads this layout, so the transformed text simply replaces the source.
  const shown = transformRunTexts(runs.map((r) => r.text), runs.map((r) => r.textTransform ?? 'none'));
  runs = runs.map((r, i) => (shown[i].text === r.text ? r : { ...r, text: shown[i].text }));

  const lines: LayoutLine[] = [];
  let currentRuns: PositionedRun[] = [];
  let lineX = 0;
  let lineMaxSize = 0;

  function commitLine() {
    const effectiveFontSize = lineMaxSize > 0 ? lineMaxSize : fontSize;
    const lineHeight = effectiveFontSize * lineHeightFactor;
    lines.push({ runs: currentRuns, width: lineX, height: lineHeight });
    currentRuns = [];
    lineX = 0;
    lineMaxSize = 0;
  }

  function processSegment(segRun: StyledRun) {
    // Already a screen-pixel layout, so a run's `{ px }` size is its size.
    const { size: effectiveSize, y: runY } = runMetrics(segRun, fontSize);
    lineMaxSize = Math.max(lineMaxSize, effectiveSize);

    if (maxWidth === Infinity) {
      const w = measure(segRun.text, effectiveSize, segRun.bold ?? false, segRun.italic ?? false);
      currentRuns.push({ ...segRun, x: lineX, width: w, y: runY, size: effectiveSize });
      lineX += w;
      return;
    }

    // Word-wrap: split run text by spaces
    const words = segRun.text.split(/ /);
    let wordBuf = '';

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const candidate = wordBuf.length > 0 ? wordBuf + ' ' + word : word;
      const candidateW = measure(candidate, effectiveSize, segRun.bold ?? false, segRun.italic ?? false);

      if (lineX + candidateW > maxWidth && (lineX > 0 || wordBuf.length > 0)) {
        // Flush current wordBuf as a run on the current line
        if (wordBuf.length > 0) {
          const w = measure(wordBuf, effectiveSize, segRun.bold ?? false, segRun.italic ?? false);
          currentRuns.push({ ...segRun, text: wordBuf, x: lineX, width: w, y: runY, size: effectiveSize });
          lineX += w;
        }
        commitLine();
        lineMaxSize = Math.max(lineMaxSize, effectiveSize);
        wordBuf = word;
      } else {
        // Either fits, or is an oversized single word starting a fresh line — accept it
        wordBuf = candidate;
      }
    }

    // Flush remaining wordBuf
    if (wordBuf.length > 0) {
      const w = measure(wordBuf, effectiveSize, segRun.bold ?? false, segRun.italic ?? false);
      currentRuns.push({ ...segRun, text: wordBuf, x: lineX, width: w, y: runY, size: effectiveSize });
      lineX += w;
    }
  }

  for (const run of runs) {
    // markdownToRuns embeds newlines inside runs; split on '\n' so each
    // segment becomes its own line via commitLine().
    const segments = run.text.split('\n');
    for (let si = 0; si < segments.length; si++) {
      if (si > 0) commitLine();
      const seg = segments[si];
      if (seg.length > 0) {
        processSegment({ ...run, text: seg });
      }
    }
  }

  // Commit final line
  if (currentRuns.length > 0) {
    commitLine();
  }

  const width = Math.max(...lines.map((l) => l.width));
  const height = lines.reduce((sum, l) => sum + l.height, 0);
  return { lines, width, height };
}

/** Pluggable text-painting strategy. The default fills white at `(x, y)`; markdown renderers replace this. */
export type TextRenderer = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) => void;

/** Font styling options threaded through `createMarkdownRenderer`. */
export interface MarkdownFontOptions {
  /** Font-family spec (e.g. `'"Iowan Old Style", Georgia, serif'`). Defaults to `sans-serif`. */
  family?: string;
  /** Numeric weight applied to non-bold runs. Bold runs always use `bold`. Default `normal`. */
  weight?: string | number;
  /** Override fill color. When set, used for all runs (italic and bold). */
  color?: string;
  /** Multiplier applied to font size for line height. Default 1.3. */
  lineHeight?: number;
}

function buildFont(
  fontSize: number,
  bold: boolean,
  italic: boolean,
  opts: MarkdownFontOptions = {},
): string {
  const family = opts.family ?? 'sans-serif';
  const weight = bold ? 'bold' : (opts.weight !== undefined ? String(opts.weight) : 'normal');
  const parts: string[] = [];
  if (italic) parts.push('italic');
  parts.push(weight);
  parts.push(`${fontSize}px ${family}`);
  return parts.join(' ');
}

function canvasMeasure(ctx: CanvasRenderingContext2D, opts: MarkdownFontOptions = {}): MeasureFn {
  return (text, fontSize, bold, italic) => {
    ctx.font = buildFont(fontSize, bold, italic, opts);
    return ctx.measureText(text).width;
  };
}

/** Distance from the context's current `textBaseline` down to the alphabetic
 *  baseline, for the font already set on it; 0 where the metric is missing. */
function alphabeticBaselineBelow(ctx: CanvasRenderingContext2D): number {
  const current = ctx.textBaseline;
  if (current === 'alphabetic') return 0;
  const here = ctx.measureText('').fontBoundingBoxAscent;
  ctx.textBaseline = 'alphabetic';
  const alphabetic = ctx.measureText('').fontBoundingBoxAscent;
  ctx.textBaseline = current;
  const d = alphabetic - here;
  return Number.isFinite(d) ? d : 0;
}

/** Where a block `width` wide starts, given the x the context aligns it to. */
function blockLeft(ctx: CanvasRenderingContext2D, x: number, width: number): number {
  const rtl = ctx.direction === 'rtl';
  switch (ctx.textAlign) {
    case 'center': return x - width / 2;
    case 'right': return x - width;
    case 'end': return rtl ? x : x - width;
    case 'start': return rtl ? x - width : x;
    default: return x;
  }
}

/**
 * Build a fill+stroke `TextRenderer` pair, laying the text out once.
 *
 * `text` is markdown, read by `markdownToRuns`, or runs already styled. The
 * block is placed by the context's `textAlign` and each run by its
 * `textBaseline`. The fill pass also paints underline, strikethrough and
 * overline in their run's fill, placed by the same metrics as the GL tier;
 * the stroke pass paints no rules, as on the GL tier.
 */
export function createMarkdownRenderer(
  ctx: CanvasRenderingContext2D,
  text: string | StyledRun[],
  fontSize: number,
  maxWidth: number = Infinity,
  fontOpts: MarkdownFontOptions = {},
): { renderer: TextRenderer; strokeRenderer: TextRenderer; width: number; height: number } {
  const measure = canvasMeasure(ctx, fontOpts);
  const parsed = typeof text === 'string' ? markdownToRuns(text) : text;
  const layout = layoutMarkdown(parsed, maxWidth, fontSize, measure, fontOpts.lineHeight);

  /** Walk the layout, setting each run's font and handing over its
   *  left-aligned paint position and the index of its line. */
  function walk(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    drawRun: (run: PositionedRun, rx: number, ry: number, lineIndex: number) => void,
  ): void {
    const align = c.textAlign;
    const left = blockLeft(c, x, layout.width);
    c.textAlign = 'left';
    let lineY = y;
    layout.lines.forEach((line, li) => {
      const lineLeft = left + (layout.width - line.width) / 2;
      for (const run of line.runs) {
        c.font = buildFont(run.size, run.bold ?? false, run.italic ?? false, fontOpts);
        drawRun(run, lineLeft + run.x, lineY + run.y, li);
      }
      lineY += line.height;
    });
    c.textAlign = align;
  }

  const renderer: TextRenderer = (_ctx, _text, x, y) => {
    interface Span {
      flags: Record<DecorationKind, boolean>;
      fill: string;
      size: number;
      baselineY: number;
      line: number;
      x0: number;
      x1: number;
    }
    let span: Span | null = null;
    const flush = (): void => {
      const s = span;
      span = null;
      if (!s || s.x1 <= s.x0) return;
      _ctx.fillStyle = s.fill;
      for (const kind of DECORATION_KINDS) {
        if (!s.flags[kind]) continue;
        const { y0, y1 } = decorationRule(kind, s.baselineY, s.size);
        _ctx.fillRect(s.x0, y0, s.x1 - s.x0, y1 - y0);
      }
    };

    walk(_ctx, x, y, (run, rx, ry, line) => {
      const fill = fontOpts.color
        ?? (run.italic && !run.bold ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF');
      _ctx.fillStyle = fill;
      _ctx.fillText(run.text, rx, ry);

      if (!(run.underline || run.strikethrough || run.overline)) {
        flush();
        return;
      }
      const flags: Record<DecorationKind, boolean> = {
        underline: run.underline ?? false,
        strikethrough: run.strikethrough ?? false,
        overline: run.overline ?? false,
      };
      const baselineY = ry + alphabeticBaselineBelow(_ctx);
      const open = span;
      if (
        open !== null
        && open.line === line
        && open.x1 === rx
        && open.fill === fill
        && open.size === run.size
        && open.baselineY === baselineY
        && DECORATION_KINDS.every((k) => open.flags[k] === flags[k])
      ) {
        open.x1 = rx + run.width;
      } else {
        flush();
        span = { flags, fill, size: run.size, baselineY, line, x0: rx, x1: rx + run.width };
      }
    });
    flush();
  };

  const strokeRenderer: TextRenderer = (_ctx, _text, x, y) => {
    walk(_ctx, x, y, (run, rx, ry) => _ctx.strokeText(run.text, rx, ry));
  };

  return { renderer, strokeRenderer, width: layout.width, height: layout.height };
}
