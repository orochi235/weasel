import { resolveScreenLength } from '@weasel-js/paint';
import type { StyledRun } from './runs';
import type { FaceMetrics, FontStyle } from '@weasel-js/font';
import { resolveRunFace, scriptMetrics } from './runs/resolveRuns';
import { graphemeCount } from './measure/graphemes';
import { transformRunTexts } from './runs/textTransform';
import { smallCapsScale, smallCapsText } from './runs/smallCaps';
import { endsHyphenated, hangs, wrapLines, type HyphenWidth } from './layout/lineBreak/wrapLines';
import { DEFAULT_TAB_SIZE, tabAdvance, widthWithTabs, type TabStop } from './layout/tabStops';

export type { StyledRun };

/** The font a run is set in: its own family, weight and style where it
 *  names them, else the node's, as `resolveRuns` resolves them for the GL
 *  path, at the run's resolved size in px. */
export interface MarkdownFont {
  fontFamily: string;
  fontWeight: number;
  fontStyle: FontStyle;
  fontSize: number;
}

/** Width of `text` set in `font`, glyphs only: `layoutMarkdown` adds a run's
 *  letter spacing itself. `createMarkdownRenderer` measures with its canvas. */
export type MeasureFn = (text: string, font: MarkdownFont) => number;

/** The face a run's rules and script presets come from, for `layoutMarkdown`.
 *  `createMarkdownRenderer` supplies one that looks the family up in the font
 *  registry, so a registered face places them as it does on the GL tier. */
export type FaceMetricsFn = (font: Omit<MarkdownFont, 'fontSize'>) => FaceMetrics | undefined;

/** A `StyledRun` with its resolved size and its position relative to the
 *  start of its line: `x` along the line, `y` off its baseline. */
export interface PositionedRun extends StyledRun {
  x: number;
  /** Advance width: what the layout's `MeasureFn` measured, plus `tracking`
   *  after every grapheme cluster, the last included. */
  width: number;
  /** Baseline offset, positive down — a superscript's is negative. Add it to
   *  the line's baseline when painting. */
  y: number;
  /** The font it is measured and painted in. Its size has `fontScale` and
   *  `script` already folded in, resolved once here so layout and paint
   *  cannot disagree about it. */
  font: MarkdownFont;
  /** The size of the run it was cut from, which holds the line and sizes its
   *  decoration rules. Differs from `font.fontSize` only on a small-caps
   *  piece drawn at the small size. */
  lineSize: number;
  /** Its letter spacing in px: added after each grapheme cluster. */
  tracking: number;
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

/** `runs` as drawn: transformed, and split by small caps where the size
 *  changes, with the small pieces marked. */
function segmentsOf(runs: readonly StyledRun[]): Segment[] {
  // No caret reads this layout, so the transformed text simply replaces the source.
  const shown = transformRunTexts(
    runs.map((r) => r.text), runs.map((r) => r.textTransform ?? 'none'), runs.map((r) => r.lang),
  );
  const segs: Segment[] = [];
  runs.forEach((r, i) => {
    const text = shown[i].text;
    if (r.fontVariantCaps !== 'small-caps') { segs.push(text === r.text ? r : { ...r, text }); return; }
    const caps = smallCapsText(text, undefined, r.lang);
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
  return segs;
}

/**
 * Word-wrap parsed runs into lines bounded by `maxWidth`, breaking at the
 * UAX #14 opportunities `layoutRuns` breaks at; pass `Infinity` for
 * single-line layout. A tab is a run of its own, as wide as it takes to reach
 * its next stop, `tabSize` spaces apart.
 */
export function layoutMarkdown(
  runs: StyledRun[],
  maxWidth: number,
  fontSize: number,
  measure: MeasureFn,
  opts: LayoutMarkdownOptions = {},
): LayoutResult {
  const lineHeightFactor = opts.lineHeight ?? 1.3;
  const tabSize = opts.tabSize ?? DEFAULT_TAB_SIZE;
  const node = {
    fontFamily: opts.family ?? 'sans-serif', fontWeight: opts.weight ?? 400, fontStyle: 'normal' as const,
  };
  if (runs.length === 0) return { lines: [], width: 0, height: 0 };
  const segs = segmentsOf(runs);

  // One sequence across every run, so a break opportunity that depends on a
  // neighbor in the next run is found the way `layoutRuns` finds it.
  const { cps, runOf, startOf, endOf } = codePointsOf(segs);
  // Already a screen-pixel layout, so a run's `{ px }` size is its size.
  const placed = segs.map(({ smallCaps, source: _source, ...run }) => {
    const runFace = resolveRunFace(run, node);
    const face = opts.faceOf?.(runFace);
    const { size: runSize, y } = runMetrics(run, fontSize, face);
    const font: MarkdownFont = { ...runFace, fontSize: smallCaps ? runSize * smallCapsScale(face) : runSize };
    const tracking = run.letterSpacing !== undefined
      ? resolveScreenLength(run.letterSpacing, 1)
      : opts.letterSpacing ?? 0;
    // As on the GL tier: the run's size holds the line, however small its capitals, and a size
    // relative to the node's holds it at least at the node's (`strutSize`).
    const holds = run.fontSize === undefined ? Math.max(runSize, fontSize) : runSize;
    return { run, face, y, runSize, holds, font, tracking };
  });
  /** A UTF-16 span of one run's text, set on the current line; `hyphen` when
   *  it closes a line wrapped at the soft hyphen it ends in, which draws as U+2010. */
  interface Piece { run: number; start: number; end: number; hyphen?: boolean }

  const pieceText = (p: Piece): string => {
    const text = placed[p.run].run.text;
    return p.hyphen ? `${text.slice(p.start, p.end - 1)}\u2010` : text.slice(p.start, p.end);
  };
  const pieceWidth = (p: Piece): number => {
    const { font, tracking } = placed[p.run];
    const text = pieceText(p);
    return measure(text, font) + (tracking === 0 ? 0 : graphemeCount(text) * tracking);
  };

  /** Code points `[from, to)` as spans of their runs' texts. */
  function piecesOf(from: number, to: number): Piece[] {
    const out: Piece[] = [];
    for (let k = from; k < to; k++) {
      const last = out[out.length - 1];
      if (last && last.run === runOf[k] && last.end === startOf[k] && cps[k] !== 9 && cps[k - 1] !== 9) {
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
      const { run, face, font, tracking, y, runSize, holds } = placed[p.run];
      const tab = run.text[p.start] === '\t' ? stopOf(p.run) : null;
      const width = tab ? tabAdvance(x, tab.stop, tab.min) : pieceWidth(p);
      positioned.push({
        ...run, text: pieceText(p), x, width, y, font, lineSize: runSize, tracking,
        ...(face ? { face } : {}),
      });
      x += width;
      maxSize = Math.max(maxSize, holds);
    }
    lines.push({ runs: positioned, width: x, height: (maxSize > 0 ? maxSize : fontSize) * lineHeightFactor });
  }

  // A tab is not tracked, but its stops are spaces with their tracking, as on the GL tier.
  const stopOf = (run: number): TabStop => {
    const { font, tracking } = placed[run];
    const space = measure(' ', font);
    return { stop: tabSize * (space + tracking), min: space / 2 };
  };
  const tabs: number[] = [];
  cps.forEach((cp, k) => { if (cp === 9) tabs.push(k); });
  const flatWidth = (start: number, end: number): number =>
    piecesOf(start, end).reduce((w, p) => w + pieceWidth(p), 0);
  const widthOf = (start: number, end: number): number =>
    widthWithTabs(start, end, tabs, (k) => stopOf(runOf[k]), flatWidth);
  const hyphenOf: HyphenWidth = (start, k) => {
    const last = piecesOf(start, k + 1).pop()!;
    return pieceWidth({ ...last, hyphen: true }) - pieceWidth(last);
  };
  for (const line of wrapLines(cps, maxWidth, widthOf, hyphenOf)) {
    let end = line.end;
    // A line's trailing spaces and tabs hang past the edge, as they do in `layoutRuns`.
    while (end > line.start && hangs(cps[end - 1])) end--;
    const pieces = piecesOf(line.start, end);
    if (endsHyphenated(cps, line.end, line.wrapped)) pieces[pieces.length - 1].hyphen = true;
    commitLine(pieces);
  }

  if (lines.length === 0) return { lines: [], width: 0, height: 0 };
  const width = lines.reduce((w, l) => Math.max(w, l.width), -Infinity);
  const height = lines.reduce((sum, l) => sum + l.height, 0);
  return { lines, width, height };
}

/** The code points of `segs` in one sequence and, per code point, its run and its UTF-16 span in that run's text. */
function codePointsOf(segs: readonly { text: string }[]) {
  const cps: number[] = [];
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
  return { cps, runOf, startOf, endOf };
}

/** Font styling options threaded through `createMarkdownRenderer`. */
export interface MarkdownFontOptions {
  /** Font-family spec (e.g. `'"Iowan Old Style", Georgia, serif'`). Defaults to `sans-serif`. */
  family?: string;
  /** Weight of a run that names none and is not bold; a bold one is 700. Default 400. */
  weight?: string | number;
  /** Letter spacing in px of a run that sets none, added after each grapheme cluster. Default 0. */
  letterSpacing?: number;
  /** Override fill color. When set, used for all runs (italic and bold). */
  color?: string;
  /** Multiplier applied to font size for line height. Default 1.3. */
  lineHeight?: number;
  /** Distance between tab stops, in spaces, as CSS `tab-size`. Default 8. */
  tabSize?: number;
}

/** What `layoutMarkdown` takes beyond its runs, width, size and measure. */
export interface LayoutMarkdownOptions extends Omit<MarkdownFontOptions, 'color'> {
  faceOf?: FaceMetricsFn;
}
