import { markdownToRuns, type StyledRun } from './runs';

export type { StyledRun };

/** Width-measurement strategy for `layoutMarkdown`; canvas-backed default supplied by `createMarkdownRenderer`. */
export type MeasureFn = (text: string, fontSize: number, bold: boolean, italic: boolean) => number;

/** A `StyledRun` with its computed x-offset relative to the start of its line. */
export interface PositionedRun extends StyledRun {
  x: number;
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
    const effectiveSize = segRun.fontSize ?? fontSize;
    lineMaxSize = Math.max(lineMaxSize, effectiveSize);

    if (maxWidth === Infinity) {
      const w = measure(segRun.text, effectiveSize, segRun.bold ?? false, segRun.italic ?? false);
      currentRuns.push({ ...segRun, x: lineX });
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
          currentRuns.push({ ...segRun, text: wordBuf, x: lineX });
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
      currentRuns.push({ ...segRun, text: wordBuf, x: lineX });
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

/** Build a fill+stroke `TextRenderer` pair for a markdown string at the given size; pre-computes layout once. */
export function createMarkdownRenderer(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  maxWidth: number = Infinity,
  fontOpts: MarkdownFontOptions = {},
): { renderer: TextRenderer; strokeRenderer: TextRenderer; width: number; height: number } {
  const measure = canvasMeasure(ctx, fontOpts);
  const parsed = markdownToRuns(text);
  const layout = layoutMarkdown(parsed, maxWidth, fontSize, measure, fontOpts.lineHeight);

  const renderer: TextRenderer = (_ctx, _text, x, y) => {
    let lineY = y;
    for (const line of layout.lines) {
      for (const run of line.runs) {
        const effSize = run.fontSize ?? fontSize;
        _ctx.font = buildFont(effSize, run.bold ?? false, run.italic ?? false, fontOpts);
        _ctx.fillStyle = fontOpts.color
          ?? (run.italic && !run.bold ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF');
        const lineOffset = (layout.width - line.width) / 2;
        _ctx.fillText(run.text, x + lineOffset + run.x, lineY);
      }
      lineY += line.height;
    }
  };

  const strokeRenderer: TextRenderer = (_ctx, _text, x, y) => {
    let lineY = y;
    for (const line of layout.lines) {
      for (const run of line.runs) {
        const effSize = run.fontSize ?? fontSize;
        _ctx.font = buildFont(effSize, run.bold ?? false, run.italic ?? false, fontOpts);
        const lineOffset = (layout.width - line.width) / 2;
        _ctx.strokeText(run.text, x + lineOffset + run.x, lineY);
      }
      lineY += line.height;
    }
  };

  return { renderer, strokeRenderer, width: layout.width, height: layout.height };
}
