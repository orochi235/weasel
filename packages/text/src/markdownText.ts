import { resolveScreenLength } from '@weasel-js/paint';
import { markdownToRuns, type StyledRun } from './runs';
import { cssFamilyName, faceMetricsFor, type FaceMetrics } from '@weasel-js/font';
import { numericWeight, scriptMetrics } from './runs/resolveRuns';
import { DECORATION_KINDS, decorationRule, type DecorationKind } from './layout/decorationMetrics';
import { transformRunTexts } from './runs/textTransform';
import { smallCapsScale, smallCapsText } from './runs/smallCaps';
import { wrapLines } from './layout/lineBreak/wrapLines';

export type { StyledRun };

/** Width-measurement strategy for `layoutMarkdown`; canvas-backed default supplied by `createMarkdownRenderer`. */
export type MeasureFn = (text: string, fontSize: number, bold: boolean, italic: boolean) => number;

/** The face a run's rules and script presets come from, for `layoutMarkdown`.
 *  `createMarkdownRenderer` supplies one that looks the family up in the font
 *  registry, so a registered face places them as it does on the GL tier. */
export type FaceMetricsFn = (bold: boolean, italic: boolean) => FaceMetrics | undefined;

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
  /** The face that placed the run's script and places its rules. */
  face?: FaceMetrics;
}

/**
 * A run's size and baseline offset, resolved the way `resolveRuns` resolves
 * them for the GL path: an absolute `fontSize` wins over a multiplier, and
 * the rise is measured against the *inherited* size so it does not shrink
 * along with the run.
 */
function runMetrics(run: StyledRun, fontSize: number, face: FaceMetrics | undefined): { size: number; y: number } {
  const script = run.script ? scriptMetrics(face)[run.script] : undefined;
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

/** A run as `layoutMarkdown` walks it: small caps has split it where its
 *  size changes, and marked the pieces drawn at the small size. */
type Segment = StyledRun & { smallCaps?: true; source?: StyledRun };

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

/**
 * Word-wrap parsed runs into lines bounded by `maxWidth`, breaking at the
 * UAX #14 opportunities `layoutRuns` breaks at; pass `Infinity` for
 * single-line layout.
 */
export function layoutMarkdown(
  runs: StyledRun[],
  maxWidth: number,
  fontSize: number,
  measure: MeasureFn,
  lineHeightFactor: number = 1.3,
  faceOf?: FaceMetricsFn,
): LayoutResult {
  if (runs.length === 0) return { lines: [], width: 0, height: 0 };
  // No caret reads this layout, so the transformed text simply replaces the source.
  const shown = transformRunTexts(runs.map((r) => r.text), runs.map((r) => r.textTransform ?? 'none'));
  // Small caps splits a run where its size changes, marking the small pieces.
  const segs: Segment[] = [];
  runs.forEach((r, i) => {
    const text = shown[i].text;
    if (r.fontVariantCaps !== 'small-caps') { segs.push(text === r.text ? r : { ...r, text }); return; }
    const caps = smallCapsText(text);
    if (!caps.small) { segs.push({ ...r, text: caps.text }); return; }
    let at = 0;
    for (const piece of caps.text) {
      const small = caps.small[at];
      at += piece.length;
      const prev = segs[segs.length - 1];
      if (prev?.source === r && (prev.smallCaps === true) === small) prev.text += piece;
      else segs.push({ ...r, text: piece, source: r, ...(small ? { smallCaps: true as const } : {}) });
    }
  });

  // One sequence across every run, so a break opportunity that depends on a
  // neighbor in the next run is found the way `layoutRuns` finds it.
  const cps: number[] = [];
  /** Per code point: its run, and its UTF-16 span in that run's text. */
  const runOf: number[] = [];
  const startOf: number[] = [];
  const endOf: number[] = [];
  segs.forEach((r, ri) => {
    let at = 0;
    for (const ch of r.text) {
      cps.push(ch.codePointAt(0)!);
      runOf.push(ri);
      startOf.push(at);
      at += ch.length;
      endOf.push(at);
    }
  });
  // Already a screen-pixel layout, so a run's `{ px }` size is its size.
  const placed = segs.map(({ smallCaps, source: _source, ...run }) => {
    const face = faceOf?.(run.bold ?? false, run.italic ?? false);
    const { size: runSize, y } = runMetrics(run, fontSize, face);
    // The run's size holds the line, as on the GL tier, however small its capitals.
    return { run, face, y, runSize, size: smallCaps ? runSize * smallCapsScale(face) : runSize };
  });
  const pieceWidth = (p: Piece): number => {
    const { run, size } = placed[p.run];
    return measure(run.text.slice(p.start, p.end), size, run.bold ?? false, run.italic ?? false);
  };

  /** A UTF-16 span of one run's text, set on the current line. */
  interface Piece { run: number; start: number; end: number }

  /** Code points `[from, to)` as spans of their runs' texts. */
  function piecesOf(from: number, to: number): Piece[] {
    const out: Piece[] = [];
    for (let k = from; k < to; k++) {
      const last = out[out.length - 1];
      if (last && last.run === runOf[k] && last.end === startOf[k]) {
        out[out.length - 1] = { ...last, end: endOf[k] };
      } else {
        out.push({ run: runOf[k], start: startOf[k], end: endOf[k] });
      }
    }
    return out;
  }

  const lines: LayoutLine[] = [];

  function commitLine(line: Piece[]) {
    let x = 0;
    let maxSize = 0;
    const positioned: PositionedRun[] = [];
    for (const p of line) {
      const { run, face, size, y, runSize } = placed[p.run];
      const width = pieceWidth(p);
      positioned.push({ ...run, text: run.text.slice(p.start, p.end), x, width, y, size, ...(face ? { face } : {}) });
      x += width;
      maxSize = Math.max(maxSize, runSize);
    }
    lines.push({ runs: positioned, width: x, height: (maxSize > 0 ? maxSize : fontSize) * lineHeightFactor });
  }

  const widthOf = (start: number, end: number): number =>
    piecesOf(start, end).reduce((w, p) => w + pieceWidth(p), 0);
  for (const line of wrapLines(cps, maxWidth, widthOf)) {
    let end = line.end;
    // A wrapped line's trailing spaces hang past the edge, as they do in `layoutRuns`.
    if (line.wrapped) while (end > line.start && cps[end - 1] === 32) end--;
    commitLine(piecesOf(line.start, end));
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
  parts.push(`${fontSize}px ${cssFamilyName(family)}`);
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
  const family = fontOpts.family ?? 'sans-serif';
  const weight = numericWeight(fontOpts.weight ?? 400);
  const faceOf: FaceMetricsFn = (bold, italic) =>
    faceMetricsFor(family, bold ? 700 : weight, italic ? 'italic' : 'normal');
  const layout = layoutMarkdown(parsed, maxWidth, fontSize, measure, fontOpts.lineHeight, faceOf);

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
      face: FaceMetrics | undefined;
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
        const { y0, y1 } = decorationRule(kind, s.baselineY, s.size, s.face);
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
        && open.face === run.face
        && open.baselineY === baselineY
        && DECORATION_KINDS.every((k) => open.flags[k] === flags[k])
      ) {
        open.x1 = rx + run.width;
      } else {
        flush();
        span = { flags, fill, size: run.size, face: run.face, baselineY, line, x0: rx, x1: rx + run.width };
      }
    });
    flush();
  };

  const strokeRenderer: TextRenderer = (_ctx, _text, x, y) => {
    walk(_ctx, x, y, (run, rx, ry) => _ctx.strokeText(run.text, rx, ry));
  };

  return { renderer, strokeRenderer, width: layout.width, height: layout.height };
}
