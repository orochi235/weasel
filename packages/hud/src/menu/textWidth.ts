import { glyphMetricsOf, cachedFontVariant } from '@weasel-js/font';

/** A width for `text` with no face to measure it in. */
export function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/** Width of `text` at `fontSize` in `fontFamily`, from the advances and
 *  kerning of the face the text command lays it out with. A face not loaded
 *  yet gives an estimate; `faceGeneration` moves when it lands. */
export function textWidth(text: string, fontSize: number, fontFamily: string): number {
  const metrics = glyphMetricsOf(cachedFontVariant(fontFamily, 400, 'normal'));
  if (!metrics) return estimateWidth(text, fontSize);
  let units = 0;
  let prev: number | null = null;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    units += metrics.advanceOf(cp) ?? metrics.size * 0.55;
    if (prev !== null) units += metrics.kernOf(prev, cp);
    prev = cp;
  }
  return units * fontSize / metrics.size;
}

const ELLIPSIS = '…';
let graphemes: Intl.Segmenter | null = null;

/** `text` held to one line of `maxWidth` px at `fontSize` in `fontFamily`, as CSS `text-overflow: ellipsis` holds a
 *  label: whole when it fits, else cut at a grapheme cluster and ended with `…`, and empty when not even `…` fits. */
export function ellipsize(text: string, maxWidth: number, fontSize: number, fontFamily: string): string {
  if (textWidth(text, fontSize, fontFamily) <= maxWidth) return text;
  if (!(textWidth(ELLIPSIS, fontSize, fontFamily) <= maxWidth)) return '';
  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const ends = [...graphemes.segment(text)].map((s) => s.index + s.segment.length);
  // The longest prefix, in whole clusters, that fits with the ellipsis after it.
  let lo = 0, hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(text.slice(0, ends[mid - 1]) + ELLIPSIS, fontSize, fontFamily) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo ? ends[lo - 1] : 0).trimEnd() + ELLIPSIS;
}
