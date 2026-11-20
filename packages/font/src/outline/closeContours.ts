/**
 * Close every contour of a glyph's path data.
 *
 * A glyph contour is closed by definition, but not every serializer writes
 * the `Z` that says so, and the omission is invisible until someone *strokes*
 * the outline: a fill closes the contour implicitly, while a stroke leaves the
 * closing edge unpainted, with a cap at each loose end. Normalized here rather
 * than in one parser so it covers every consumer-supplied `OutlineParser`.
 * A contour a relative `m` continues from stays as written.
 */
export function closeContours(d: string): string {
  let out = '';
  let start = 0;
  for (let i = 1; i < d.length; i++) {
    const c = d[i];
    if (c !== 'M' && c !== 'm') continue;
    // A `Z` returns the pen to the contour's start, which a relative `m` is
    // then measured from: closing here would move every contour after it.
    out += closeOne(d.slice(start, i), c === 'M');
    start = i;
  }
  return out + closeOne(d.slice(start), true);
}

function closeOne(contour: string, close: boolean): string {
  const trimmed = contour.trimEnd();
  if (trimmed.length === 0 || !close) return trimmed;
  const last = trimmed[trimmed.length - 1];
  return last === 'Z' || last === 'z' ? trimmed : `${trimmed}Z`;
}
