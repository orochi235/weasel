/**
 * The 2D-canvas painter over `layoutMarkdown`: measures with the context it
 * is given and paints each positioned run, tracking and decoration rules
 * included, where the layout put it.
 */
import { faceMetricsFor, type FaceMetrics } from '@weasel-js/font';
import { markdownToRuns, type StyledRun } from './runs';
import { fontString } from './textStyle';
import { graphemeEnds } from './measure/graphemes';
import { DECORATION_KINDS, decorationRule, type DecorationKind } from './layout/decorationMetrics';
import {
  layoutMarkdown, type FaceMetricsFn, type MarkdownFontOptions, type MeasureFn, type PositionedRun,
} from './markdownText';

/** Pluggable text-painting strategy. The default fills white at `(x, y)`; markdown renderers replace this. */
export type TextRenderer = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) => void;

/** Whether `ctx` tracks text itself (`CanvasRenderingContext2D.letterSpacing`). */
const tracksItself = (ctx: CanvasRenderingContext2D): boolean => typeof ctx.letterSpacing === 'string';

function canvasMeasure(ctx: CanvasRenderingContext2D): MeasureFn {
  return (text, font) => {
    ctx.font = fontString(font);
    if (!tracksItself(ctx) || ctx.letterSpacing === '0px') return ctx.measureText(text).width;
    const held = ctx.letterSpacing;
    ctx.letterSpacing = '0px';
    const width = ctx.measureText(text).width;
    ctx.letterSpacing = held;
    return width;
  };
}

/** Paint `text` at `x` with `tracking` px after each grapheme cluster: through
 *  the context's own `letterSpacing` where it has one, else a cluster at a time. */
function paintTracked(
  c: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number,
  draw: (text: string, x: number, y: number) => void,
): void {
  if (tracksItself(c)) {
    c.letterSpacing = `${tracking}px`;
    draw(text, x, y);
    return;
  }
  if (tracking === 0) { draw(text, x, y); return; }
  let pen = x;
  let from = 0;
  for (const end of graphemeEnds(text)) {
    const cluster = text.slice(from, end);
    draw(cluster, pen, y);
    pen += c.measureText(cluster).width + tracking;
    from = end;
  }
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

/** How far toward its right edge the context's `textAlign` sets text: 0 for
 *  left, 1/2 for center, 1 for right, with `start` and `end` read against its
 *  `direction`. It places the block about `x` and each line within the block. */
function alignShare(ctx: CanvasRenderingContext2D): number {
  const rtl = ctx.direction === 'rtl';
  switch (ctx.textAlign) {
    case 'center': return 0.5;
    case 'right': return 1;
    case 'end': return rtl ? 0 : 1;
    case 'start': return rtl ? 1 : 0;
    default: return 0;
  }
}

/**
 * Build a fill+stroke `TextRenderer` pair, laying the text out once.
 *
 * `text` is markdown, read by `markdownToRuns`, or runs already styled. The
 * block, and each line within it, is placed by the context's `textAlign`,
 * and each run by its `textBaseline`. The fill pass also paints underline, strikethrough and
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
  const parsed = typeof text === 'string' ? markdownToRuns(text) : text;
  const faceOf: FaceMetricsFn = (f) => faceMetricsFor(f.fontFamily, f.fontWeight, f.fontStyle);
  const layout = layoutMarkdown(parsed, maxWidth, fontSize, canvasMeasure(ctx), { ...fontOpts, faceOf });

  /** Walk the layout, setting each run's font and handing over its
   *  left-aligned paint position and the index of its line. */
  function walk(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    drawRun: (run: PositionedRun, rx: number, ry: number, lineIndex: number) => void,
  ): void {
    const align = c.textAlign;
    const spacing = tracksItself(c) ? c.letterSpacing : null;
    const share = alignShare(c);
    const left = x - layout.width * share;
    c.textAlign = 'left';
    let lineY = y;
    layout.lines.forEach((line, li) => {
      const lineLeft = left + (layout.width - line.width) * share;
      for (const run of line.runs) {
        c.font = fontString(run.font);
        drawRun(run, lineLeft + run.x, lineY + run.y, li);
      }
      lineY += line.height;
    });
    c.textAlign = align;
    if (spacing !== null) c.letterSpacing = spacing;
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
      paintTracked(_ctx, run.text, rx, ry, run.tracking, (t, tx, ty) => _ctx.fillText(t, tx, ty));

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
        && open.size === run.lineSize
        && open.face === run.face
        && open.baselineY === baselineY
        && DECORATION_KINDS.every((k) => open.flags[k] === flags[k])
      ) {
        open.x1 = rx + run.width;
      } else {
        flush();
        // The run's size, not the piece's: a small-caps word is one rule.
        span = { flags, fill, size: run.lineSize, face: run.face, baselineY, line, x0: rx, x1: rx + run.width };
      }
    });
    flush();
  };

  const strokeRenderer: TextRenderer = (_ctx, _text, x, y) => {
    walk(_ctx, x, y, (run, rx, ry) =>
      paintTracked(_ctx, run.text, rx, ry, run.tracking, (t, tx, ty) => _ctx.strokeText(t, tx, ty)));
  };

  return { renderer, strokeRenderer, width: layout.width, height: layout.height };
}
