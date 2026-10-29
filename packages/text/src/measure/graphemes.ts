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
  // Written by index and cut to length once: `length = 0` drops the backing
  // store, so pushing after it reallocated `into` every call.
  let n = 0;
  // Nothing below U+0300 extends a cluster except the LF of a CRLF, so text
  // made only of those is one cluster per code unit without asking.
  if (!NEEDS_SEGMENTING.test(text)) {
    for (let i = 1; i <= text.length; i++) out[n++] = i;
  } else {
    const seg = graphemeSegmenter();
    if (seg) {
      n = segmentedEnds(seg, text, out);
    } else {
      let at = 0;
      for (const ch of text) out[n++] = at += ch.length;
    }
  }
  out.length = n;
  return out;
}

/** A code unit no cluster rule reaches across: below U+0300, and not a CR. */
const plain = (u: number): boolean => u < 0x300 && u !== 13;

/**
 * {@link graphemeEnds} through `seg`, written into `out`, returning the count.
 * `seg` allocates for every cluster it hands out, so it is asked only about
 * the clusters of stretches that need it: between two plain units there is
 * always a boundary. A stretch runs from the plain unit before its first other
 * unit to the plain unit after its last, since a prepended mark joins the one
 * after it and an emoji sequence can open on © or ®.
 */
function segmentedEnds(seg: Intl.Segmenter, text: string, out: number[]): number {
  const len = text.length;
  let segments: Intl.Segments | null = null;
  let n = 0;
  let i = 0;
  while (i < len) {
    if (plain(text.charCodeAt(i)) && (i + 1 === len || plain(text.charCodeAt(i + 1)))) {
      out[n++] = ++i;
      continue;
    }
    let end = i + 1;
    for (;;) {
      while (end < len && !plain(text.charCodeAt(end))) end++;
      if (end === len) break;
      end++;
      if (end === len || plain(text.charCodeAt(end))) break;
    }
    segments ??= seg.segment(text);
    while (i < end) {
      const s = segments.containing(i)!;
      out[n++] = i = s.index + s.segment.length;
    }
  }
  return n;
}

/** Number of grapheme clusters in `text`: how many times it is tracked. */
export function graphemeCount(text: string): number {
  return graphemeEnds(text).length;
}
