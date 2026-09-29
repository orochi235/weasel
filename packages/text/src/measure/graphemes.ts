/**
 * Grapheme clusters: the unit CSS `letter-spacing` tracks, and therefore the
 * unit every tracked width in this package counts. `measuredWidth` and
 * `layoutRuns` both read clusters from here, so the 2D path, the GL path and
 * a DOM overlay agree on how many gaps a string has.
 */

let segmenter: Intl.Segmenter | null | undefined;

function graphemeSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
  }
  return segmenter;
}

/**
 * UTF-16 offsets just past each grapheme cluster of `text`, ascending — the
 * last is `text.length`. Without `Intl.Segmenter` every code point is its own
 * cluster.
 */
export function graphemeEnds(text: string): number[] {
  const out: number[] = [];
  const seg = graphemeSegmenter();
  if (seg) {
    for (const s of seg.segment(text)) out.push(s.index + s.segment.length);
    return out;
  }
  let at = 0;
  for (const ch of text) out.push(at += ch.length);
  return out;
}

/** Number of grapheme clusters in `text`: how many times it is tracked. */
export function graphemeCount(text: string): number {
  return graphemeEnds(text).length;
}
