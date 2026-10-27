/**
 * A `<tspan dx>` list read as letter spacing. `dx` moves a glyph, and every
 * glyph after it, along the line; the same distance as extra advance on the
 * glyph before it draws the same text, and takes no font to work out. An `x`
 * list placing each glyph reads the same way once a loaded face says how far
 * each glyph would have gone on its own.
 */
import {
  layoutRuns, resolveRuns, resolveScreenLength, resolveTextStyle, type StyledRun, type TextStyle,
} from '@weasel-js/core';
import { resolveLength } from './lengths';

/** White space SVG's default handling would drop or fold, which moves every
 *  glyph after it to another place in the list. */
const COLLAPSIBLE = /^\s|\s$|\s\s|[\n\t\r]/;

function readList(el: Element, name: 'x' | 'dx', onWarn: (m: string) => void): number[] {
  const raw = el.getAttribute(name)?.trim();
  if (!raw) return [];
  return raw.split(/[\s,]+/).map((v) => resolveLength(v, el, name, 'x', 0, onWarn));
}

/** Where each glyph of `run` sits on a line of its own, from the first glyph's
 *  pen position, or `null` where no loaded face measures them all or the
 *  layout does not give one place per glyph. */
function penPositions(run: StyledRun, style: TextStyle): number[] | null {
  const resolved = resolveTextStyle(style);
  if (resolved.direction === 'rtl') return null;
  const { lines } = layoutRuns(resolveRuns([run], resolved), {
    maxWidth: Infinity, lineHeight: resolved.lineHeight, align: 'left', direction: 'ltr', tabSize: resolved.tabSize,
  });
  const line = lines[0];
  const glyphs = Array.from(run.text).length;
  if (lines.length !== 1 || !line || line.cells.length !== glyphs || !(line.x1 - line.x0 > 0)) return null;
  return line.cells.map((c) => c.x - line.cells[0]!.x);
}

/**
 * `el`'s `dx` list with its `x` list folded in: the extra advance each glyph
 * `i` takes after the one before it, `dx[0]` moving the first. `null` when it
 * moves nothing. An `x` list placing more than its first glyph is read only
 * where a loaded face measures `run`'s glyphs; otherwise it is reported.
 */
function foldPositions(
  el: Element, dx: readonly number[], x: readonly number[], run: StyledRun, style: TextStyle,
  onWarn: (m: string) => void,
): number[] | null {
  const pens = x.length > 1 ? penPositions(run, style) : null;
  if (x.length > 1 && !pens) {
    onWarn(`<${el.tagName.toLowerCase()} x="${el.getAttribute('x')?.trim()}"> positions each glyph; only the first value is read`);
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

/**
 * Add `tspan`'s run to the last of `lines`, spaced as its `dx` and `x` lists
 * say, in `style`, the text's own. `tspan` may be a `<text>` holding only
 * text, whose lists read the same way.
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
): number {
  const line = lines[lines.length - 1];
  const tag = tspan.tagName.toLowerCase();
  const dxList = readList(tspan, 'dx', onWarn);
  const xList = readList(tspan, 'x', onWarn);
  if (COLLAPSIBLE.test(run.text) && (dxList.some((v) => v !== 0) || xList.length > 1)) {
    const lists = [dxList.some((v) => v !== 0) ? 'dx' : null, xList.length > 1 ? 'x' : null]
      .flatMap((n) => (n ? [`${n}="${tspan.getAttribute(n)}"`] : []));
    onWarn(`<${tag} ${lists.join(' ')}> is not read: its text has white space SVG collapses, which moves the glyphs the list names`);
    line.push(run);
    return 0;
  }
  const dx = foldPositions(tspan, dxList, xList, run, style, onWarn);
  if (!dx) {
    line.push(run);
    return 0;
  }
  const raw = tspan.getAttribute('dx') ?? tspan.getAttribute('x');
  let lead = 0;
  let before = line.length - 1;
  while (before >= 0 && line[before].text === '') before--;
  if (dx[0] !== 0 && before >= 0) {
    const glyphs = Array.from(line[before].text);
    line.splice(before, 1, ...spread(line[before], [...glyphs.slice(1).map(() => 0), dx[0]], style));
  } else if (dx[0] !== 0 && lines.length === 1) {
    lead = dx[0];
  } else if (dx[0] !== 0) {
    onWarn(`<${tag} dx="${raw}"> opens a line; the line starts at the box edge, and the rest of the list is read`);
  }
  line.push(...spread(run, dx.slice(1), style));
  return lead;
}
