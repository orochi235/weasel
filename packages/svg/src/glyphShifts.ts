/**
 * A `<tspan dx>` list read as letter spacing. `dx` moves a glyph, and every
 * glyph after it, along the line; the same distance as extra advance on the
 * glyph before it draws the same text, and takes no font to work out. An `x`
 * list placing each glyph reads the same way once a loaded face says how far
 * each glyph would have gone on its own.
 *
 * `dx` moves toward +x whichever way the text reads, so in right-to-left text,
 * where the glyphs after one sit to its left, it narrows the gap before the
 * glyph instead of widening it.
 */
import {
  layoutRuns, resolveRuns, resolveScreenLength, resolveTextStyle, type StyledRun, type TextStyle,
} from '@weasel-js/core';
import { resolveLength } from './lengths';

/** White space SVG's default handling would drop or fold, which moves every
 *  glyph after it to another place in the list. */
export const COLLAPSIBLE = /^\s|\s$|\s\s|[\n\t\r]/;

/** A glyph positioning list: `x`, `dx`, `y` or `dy`. */
export function readList(el: Element, name: 'x' | 'dx' | 'y' | 'dy', onWarn: (m: string) => void): number[] {
  const raw = el.getAttribute(name)?.trim();
  if (!raw) return [];
  const axis = name.endsWith('x') ? 'x' : 'y';
  return raw.split(/[\s,]+/).map((v) => resolveLength(v, el, name, axis, 0, onWarn));
}

/** The lists one run is placed by, and where they were written. */
interface Lists {
  tag: string;
  dx: readonly number[];
  x: readonly number[];
  /** The `dx` and `x` attributes as written, for messages. */
  raw: { dx: string | null; x: string | null };
}

type Line = ReturnType<typeof layoutRuns>['lines'][number];
type Cells = Line['cells'];

/** Each glyph's pen, by cell: its left edge, or in right-to-left text the
 *  right edge of the glyph itself. A cell's advance would carry the kerning
 *  before the glyph to its left past that edge. */
function pensOf(line: Line, rtl: boolean): number[] {
  const pens = line.cells.map((c) => c.x);
  if (rtl) for (const g of line.glyphs) pens[g.cell] = g.x + g.advance;
  return pens;
}

/** `run`'s cells on a line of its own, or `null` where the layout does not
 *  give one per glyph. */
function cellsOf(run: StyledRun, style: TextStyle, rtl: boolean): { cells: Cells; line: Line; width: number } | null {
  const resolved = resolveTextStyle(style);
  const { lines } = layoutRuns(resolveRuns([run], resolved), {
    maxWidth: Infinity, lineHeight: resolved.lineHeight, align: rtl ? 'right' : 'left',
    direction: rtl ? 'rtl' : 'ltr', tabSize: resolved.tabSize,
  });
  const line = lines[0];
  if (lines.length !== 1 || !line || line.cells.length !== Array.from(run.text).length) return null;
  return { cells: line.cells, line, width: line.x1 - line.x0 };
}

/** Whether every cell reads the paragraph's way: a shift that moves the
 *  glyphs after one moves only those on one side of it. */
const allRead = (cells: Cells, rtl: boolean): boolean => cells.every((c) => c.level % 2 === (rtl ? 1 : 0));

/** Where each glyph's pen sits on a line of its own, from the first glyph's:
 *  its left edge, or in right-to-left text its right. `null` where no loaded
 *  face measures them all or a glyph reads against the paragraph. */
function penPositions(run: StyledRun, style: TextStyle, rtl: boolean): number[] | null {
  const laid = cellsOf(run, style, rtl);
  if (!laid || !(laid.width > 0) || !allRead(laid.cells, rtl)) return null;
  const pens = pensOf(laid.line, rtl);
  return pens.map((p) => p - pens[0]!);
}

/**
 * The `dx` list with the `x` list folded in: how far toward +x glyph `i` moves
 * from where the one before it leaves it, `dx[0]` moving the first. `null`
 * when it moves nothing. An `x` list placing more than its first glyph is
 * read only where a loaded face measures `run`'s glyphs; otherwise it is
 * reported.
 */
function foldPositions(
  lists: Lists, run: StyledRun, style: TextStyle, rtl: boolean, onWarn: (m: string) => void,
): number[] | null {
  const { dx, x } = lists;
  const pens = x.length > 1 ? penPositions(run, style, rtl) : null;
  if (x.length > 1 && !pens) {
    onWarn(`<${lists.tag} x="${lists.raw.x?.trim()}"> positions each glyph; only the first value is read`);
  }
  const placed = pens ? Math.min(x.length, pens.length) : 0;
  const out = Array.from({ length: Math.max(dx.length, placed) }, (_, i) => {
    const own = dx[i] ?? 0;
    if (i === 0 || i >= placed) return own;
    return x[i]! + own - (x[i - 1]! + (dx[i - 1] ?? 0)) - (pens![i]! - pens![i - 1]!);
  });
  return out.some((v) => v !== 0) ? out : null;
}

const spacingOf = (run: StyledRun, inherited: TextStyle['letterSpacing']): number =>
  resolveScreenLength(run.letterSpacing ?? inherited ?? 0, 1);

/** `run` as one run per stretch of glyphs spaced alike, glyph `i` taking
 *  `extra[i]` on top of the spacing it had. */
function spread(run: StyledRun, extra: readonly number[], style: TextStyle): StyledRun[] {
  const base = spacingOf(run, style.letterSpacing);
  const out: StyledRun[] = [];
  let last: number | undefined;
  Array.from(run.text).forEach((glyph, i) => {
    const more = extra[i] ?? 0;
    if (out.length > 0 && more === last) out[out.length - 1].text += glyph;
    else out.push(more === 0 ? { ...run, text: glyph } : { ...run, text: glyph, letterSpacing: base + more });
    last = more;
  });
  return out;
}

/** Add `run` to the last of `lines`, spaced as `lists` say. See `placeTspanRun`. */
function placeRun(
  lists: Lists, run: StyledRun, lines: StyledRun[][], style: TextStyle, onWarn: (m: string) => void,
): number {
  const line = lines[lines.length - 1];
  const names = (['dx', 'x'] as const).filter((n) => (n === 'dx' ? lists.dx.some((v) => v !== 0) : lists.x.length > 1));
  const named = `<${lists.tag} ${names.map((n) => `${n}="${lists.raw[n]}"`).join(' ')}>`;
  if (names.length > 0 && COLLAPSIBLE.test(run.text)) {
    onWarn(`${named} is not read: its text has white space SVG collapses, which moves the glyphs the list names`);
    line.push(run);
    return 0;
  }
  const rtl = style.direction === 'rtl';
  const shifts = names.length > 0 ? foldPositions(lists, run, style, rtl, onWarn) : null;
  // Spacing moves the glyphs after one to one side only, which a glyph read
  // against the paragraph's direction does not keep.
  const laid = shifts && rtl ? cellsOf(run, style, rtl) : null;
  if (shifts && rtl && !(laid && allRead(laid.cells, rtl))) {
    onWarn(`${named} is not read: in right-to-left text it is read only where a bidi engine says every glyph reads right to left`);
    line.push(run);
    return 0;
  }
  if (!shifts) {
    line.push(run);
    return 0;
  }
  const dx = rtl ? shifts.map((v) => -v) : shifts;
  let lead = 0;
  let before = line.length - 1;
  while (before >= 0 && line[before].text === '') before--;
  if (dx[0] !== 0 && before >= 0) {
    const glyphs = Array.from(line[before].text);
    line.splice(before, 1, ...spread(line[before], [...glyphs.slice(1).map(() => 0), dx[0]], style));
  } else if (dx[0] !== 0 && lines.length === 1) {
    // Moves the whole line, which is a distance toward +x either way.
    lead = shifts[0];
  } else if (dx[0] !== 0) {
    onWarn(`${named} opens a line; the line starts at the box edge, and the rest of the list is read`);
  }
  line.push(...spread(run, dx.slice(1), style));
  return lead;
}

/**
 * Add `tspan`'s run to the last of `lines`, spaced as its `dx` and `x` lists
 * say, in `style`, the text's own. `tspan` may be a `<text>` holding only
 * text, whose lists read the same way. `inherited` is the stretch of the
 * enclosing `<text>`'s `dx` list over this run's glyphs, which the tspan's own
 * values replace where it has them.
 * Glyph `i` takes `dx[i + 1]` as extra advance, and `dx[0]` goes on the glyph
 * before the tspan. With no glyph before it, `dx[0]` moves where the line
 * starts: returned for the first line, whose start is the text's own `x`, and
 * reported for a later one, which the model starts at the box edge.
 */
export function placeTspanRun(
  tspan: Element,
  run: StyledRun,
  lines: StyledRun[][],
  style: TextStyle,
  onWarn: (m: string) => void,
  inherited: Inherited = { dx: [], raw: null },
): number {
  const own = readList(tspan, 'dx', onWarn);
  const borrows = own.length < inherited.dx.length;
  // Name the text in a message about a list that is all the text's.
  const theirs = borrows && own.length === 0;
  return placeRun({
    tag: theirs ? 'text' : tspan.tagName.toLowerCase(),
    dx: borrows ? [...own, ...inherited.dx.slice(own.length)] : own,
    x: readList(tspan, 'x', onWarn),
    raw: { dx: theirs ? inherited.raw : tspan.getAttribute('dx'), x: tspan.getAttribute('x') },
  }, run, lines, style, onWarn);
}

/** A stretch of a `<text>`'s `dx` list, and the list as written. */
export interface Inherited { dx: readonly number[]; raw: string | null }

/** One of a `<text>`'s runs, and the `<tspan>` it came from, or `null` for bare text. */
export interface Piece { tspan: Element | null; run: StyledRun }

/**
 * A `<text>`'s `x` list folded into its `dx` list, as `foldPositions` folds a
 * run's, or the reason it cannot be. The glyphs it places are measured
 * together, through every run they fall in, in `style`, the text's own.
 */
function foldTextPositions(
  x: readonly number[], dx: readonly number[], pieces: readonly Piece[], style: TextStyle,
): number[] | string {
  const reached: StyledRun[] = [];
  for (let at = 0, k = 0; at < x.length && k < pieces.length; k++) {
    const { tspan, run } = pieces[k]!;
    const own = tspan && (['x', 'dx'] as const).find((n) => tspan.hasAttribute(n));
    if (own) return `a <tspan> it reaches has its own ${own}`;
    reached.push(run);
    at += Array.from(run.text).length;
  }
  const rtl = style.direction === 'rtl';
  const resolved = resolveTextStyle(style);
  const { lines } = layoutRuns(resolveRuns(reached, resolved), {
    maxWidth: Infinity, lineHeight: resolved.lineHeight, align: rtl ? 'right' : 'left',
    direction: rtl ? 'rtl' : 'ltr', tabSize: resolved.tabSize,
  });
  const line = lines.length === 1 ? lines[0]! : null;
  const glyphs = reached.reduce((n, r) => n + Array.from(r.text).length, 0);
  if (!line || line.cells.length !== glyphs || !(line.x1 > line.x0)) return 'no loaded face measures its glyphs';
  if (!allRead(line.cells, rtl)) {
    return 'in right-to-left text it is read only where a bidi engine says every glyph reads right to left';
  }
  const placed = Math.min(x.length, glyphs);
  const pens = pensOf(line, rtl);
  const pen = (i: number): number => pens[i]!;
  const at = (i: number): number => x[i]! + (dx[i] ?? 0);
  return Array.from({ length: Math.max(dx.length, placed) }, (_, i) => (
    i === 0 || i >= placed ? dx[i] ?? 0 : at(i) - at(i - 1) - (pen(i) - pen(i - 1))
  ));
}

/**
 * A `<text>`'s `dx` list, handed out to the runs of its children in order:
 * each value moves one glyph, counting through the text and every `<tspan>`.
 * Its `x` list past the first value, which places the text, is folded in,
 * measured over `pieces`, the text's runs, in `style`.
 */
export class TextShifts {
  private readonly dx: number[];
  private readonly raw: string | null;
  private at = 0;

  constructor(
    text: Element, private readonly onWarn: (m: string) => void, pieces: readonly Piece[] = [], style: TextStyle = {},
  ) {
    this.raw = text.getAttribute('dx');
    const dx = readList(text, 'dx', onWarn);
    const x = readList(text, 'x', onWarn);
    // Collapsing white space moves which glyph each value names.
    const collapsible = COLLAPSIBLE.test(text.textContent ?? '');
    const collapses = dx.some((v) => v !== 0) && collapsible;
    if (collapses) {
      onWarn(`<text dx="${this.raw}"> is not read: its text has white space SVG collapses, which moves the glyphs the list names`);
    }
    this.dx = collapses ? [] : dx;
    if (x.length < 2) return;
    const folded = collapsible
      ? 'its text has white space SVG collapses, which moves the glyphs the list names'
      : foldTextPositions(x, this.dx, pieces, style);
    if (typeof folded === 'string') {
      onWarn(`<text x="${text.getAttribute('x')?.trim()}"> positions each glyph; only the first value is read: ${folded}`);
    } else {
      this.dx = folded;
    }
  }

  /** The values over the next `run`'s glyphs, empty when they move none. */
  take(run: StyledRun): Inherited {
    const n = Array.from(run.text).length;
    const out = this.dx.slice(this.at, this.at + n);
    this.at += n;
    return { dx: out.some((v) => v !== 0) ? out : [], raw: this.raw };
  }

  /** Add a bare text run of the `<text>` to `lines`, spaced by its stretch of the list. */
  place(run: StyledRun, lines: StyledRun[][], style: TextStyle): number {
    const { dx } = this.take(run);
    if (dx.length === 0) {
      lines[lines.length - 1].push(run);
      return 0;
    }
    return placeRun({ tag: 'text', dx, x: [], raw: { dx: this.raw, x: null } }, run, lines, style, this.onWarn);
  }
}
