/**
 * A `<tspan dx>` list read as letter spacing. `dx` moves a glyph, and every
 * glyph after it, along the line; the same distance as extra advance on the
 * glyph before it draws the same text, and takes no font to work out.
 */
import { resolveScreenLength, type StyledRun, type TextStyle } from '@weasel-js/core';
import { resolveLength } from './lengths';

/** White space SVG's default handling would drop or fold, which moves every
 *  glyph after it to another place in the list. */
const COLLAPSIBLE = /^\s|\s$|\s\s|[\n\t\r]/;

function readDx(el: Element, onWarn: (m: string) => void): number[] | null {
  const raw = el.getAttribute('dx')?.trim();
  if (!raw) return null;
  const values = raw.split(/[\s,]+/).map((v) => resolveLength(v, el, 'dx', 'x', 0, onWarn));
  return values.some((v) => v !== 0) ? values : null;
}

const spacingOf = (run: StyledRun, inherited: TextStyle['letterSpacing']): number =>
  resolveScreenLength(run.letterSpacing ?? inherited ?? 0, 1);

/** `run` as one run per stretch of glyphs spaced alike, glyph `i` taking
 *  `extra[i]` on top of the spacing it had. */
function spread(run: StyledRun, extra: readonly number[], inherited: TextStyle['letterSpacing']): StyledRun[] {
  const base = spacingOf(run, inherited);
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
 * Add `tspan`'s run to the last of `lines`, spaced as its `dx` list says.
 * `tspan` may be a `<text>` holding only text, whose `dx` reads the same way.
 * Glyph `i` takes `dx[i + 1]` as extra advance, and `dx[0]` goes on the glyph
 * before the tspan. With no glyph before it, `dx[0]` moves where the line
 * starts: returned for the first line, whose start is the text's own `x`, and
 * reported for a later one, which the model starts at the box edge.
 */
export function placeTspanRun(
  tspan: Element,
  run: StyledRun,
  lines: StyledRun[][],
  inherited: TextStyle['letterSpacing'],
  onWarn: (m: string) => void,
): number {
  const line = lines[lines.length - 1];
  const dx = readDx(tspan, onWarn);
  if (!dx) {
    line.push(run);
    return 0;
  }
  const raw = tspan.getAttribute('dx');
  const tag = tspan.tagName.toLowerCase();
  if (COLLAPSIBLE.test(run.text)) {
    onWarn(`<${tag} dx="${raw}"> is not read: its text has white space SVG collapses, which moves the glyphs the list names`);
    line.push(run);
    return 0;
  }
  let lead = 0;
  let before = line.length - 1;
  while (before >= 0 && line[before].text === '') before--;
  if (dx[0] !== 0 && before >= 0) {
    const glyphs = Array.from(line[before].text);
    line.splice(before, 1, ...spread(line[before], [...glyphs.slice(1).map(() => 0), dx[0]], inherited));
  } else if (dx[0] !== 0 && lines.length === 1) {
    lead = dx[0];
  } else if (dx[0] !== 0) {
    onWarn(`<${tag} dx="${raw}"> opens a line; the line starts at the box edge, and the rest of the list is read`);
  }
  line.push(...spread(run, dx.slice(1), inherited));
  return lead;
}
