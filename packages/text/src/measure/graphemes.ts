/**
 * Grapheme clusters: the unit CSS `letter-spacing` tracks, and therefore the
 * unit every tracked width in this package counts. `measuredWidth` and
 * `layoutRuns` both read clusters from here, so the 2D path, the GL path and
 * a DOM overlay agree on how many gaps a string has.
 */

let segmenter: Intl.Segmenter | null | undefined;

const NEEDS_SEGMENTING = /[\r\u0300-\uffff]/;

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
 * cluster. With `into`, that array is emptied, refilled and returned.
 */
export function graphemeEnds(text: string, into?: number[]): number[] {
  const out = into ?? [];
  out.length = 0;
  // Nothing below U+0300 extends a cluster except the LF of a CRLF, so text
  // made only of those is one cluster per code unit without asking.
  if (!NEEDS_SEGMENTING.test(text)) {
    for (let i = 1; i <= text.length; i++) out.push(i);
    return out;
  }
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
