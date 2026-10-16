import { metricsOf, resolveFontVariant } from '@weasel-js/font';

/** Width of `text` at `fontSize` in `fontFamily`, from the advances and
 *  kerning of the face the text command lays it out with. A face not loaded
 *  yet gives an estimate; `faceGeneration` moves when it lands. */
export function measureLabel(text: string, fontSize: number, fontFamily: string): number {
  const metrics = metricsOf(resolveFontVariant(fontFamily, 400, 'normal'));
  if (!metrics) return text.length * fontSize * 0.55;
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
