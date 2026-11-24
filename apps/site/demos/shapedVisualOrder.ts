import type { ShapedGlyph } from '@weasel-js/text-shaping';

/** Direction runs of `glyphs`, in the order they came. */
function runs(glyphs: readonly ShapedGlyph[]): ShapedGlyph[][] {
  const out: ShapedGlyph[][] = [];
  for (const g of glyphs) {
    const last = out.at(-1);
    if (last && last[0].rtl === g.rtl) last.push(g);
    else out.push([g]);
  }
  return out;
}

/** An RTL run's clusters reversed, each cluster's own glyphs kept as `shape` drew them. */
function reverseClusters(run: readonly ShapedGlyph[]): ShapedGlyph[] {
  const out: ShapedGlyph[] = [];
  let hi = run.length;
  while (hi > 0) {
    let lo = hi - 1;
    while (lo > 0 && run[lo - 1].cluster === run[hi - 1].cluster) lo--;
    out.push(...run.slice(lo, hi));
    hi = lo;
  }
  return out;
}

/**
 * The glyphs of separately shaped strings, given in logical order, in the order
 * a pen meets them left to right. The line reads right to left when its first
 * glyph does; an embedded run of the other direction keeps its own order, even
 * when it spans several strings.
 */
export function visualOrder(shaped: readonly (readonly ShapedGlyph[])[]): ShapedGlyph[] {
  // Each string's own runs, joined across string boundaries by direction; clusters stay per string.
  const levels: ShapedGlyph[][][] = [];
  for (const run of shaped.flatMap((p) => runs(p))) {
    const last = levels.at(-1);
    if (last && last[0][0].rtl === run[0].rtl) last.push(run);
    else levels.push([run]);
  }
  const rtlLine = levels.length > 0 && levels[0][0][0].rtl;
  const ordered = rtlLine ? [...levels].reverse() : levels;
  return ordered.flatMap((level) =>
    level[0][0].rtl ? [...level].reverse().flatMap(reverseClusters) : level.flat(),
  );
}
