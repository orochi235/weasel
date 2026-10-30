import { registeredBidi, warnRtlWithoutEngine, type BidiResolver } from '@weasel-js/text';

const BIDI_CONTROLS = /^[؜‎‏‪-‮⁦-⁩]+$/;

/**
 * `graphemes`, one paragraph in logical order, as a run reading `direction` lays them: in display order left to right
 * under `'ltr'`, right to left under `'rtl'`. A grapheme in a right-to-left stretch takes its mirrored glyph, `(` for
 * `)`. Graphemes holding only bidi controls drop out. Reordering takes the engine `registerBidi` was given; with none,
 * the graphemes keep their logical order.
 */
export function visualGraphemes(
  graphemes: readonly string[],
  direction: 'ltr' | 'rtl',
  bidi: BidiResolver | null = registeredBidi(),
): string[] {
  const codePoints: number[] = [];
  const owner: number[] = [];
  graphemes.forEach((g, i) => {
    for (const ch of g) {
      codePoints.push(ch.codePointAt(0)!);
      owner.push(i);
    }
  });
  if (codePoints.length === 0) return [];
  if (bidi === null) {
    warnRtlWithoutEngine(codePoints, 'weasel CurvedLabel');
    return graphemes.filter((g) => !BIDI_CONTROLS.test(g));
  }
  const { order, levels } = bidi.reorder(bidi.analyze(codePoints, direction), 0, codePoints.length);
  const seen = new Set<number>();
  const out: string[] = [];
  for (const k of order) {
    const i = owner[k]!;
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(levels[k]! % 2 === 1 ? mirrored(bidi, graphemes[i]!) : graphemes[i]!);
  }
  return direction === 'rtl' ? out.reverse() : out;
}

function mirrored(bidi: BidiResolver, g: string): string {
  const first = g.codePointAt(0)!;
  const m = bidi.mirror(first);
  return m === null ? g : String.fromCodePoint(m) + g.slice(String.fromCodePoint(first).length);
}
