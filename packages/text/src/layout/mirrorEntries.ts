/** Bidi mirroring (UAX #9 L4) laid over measured entries. */
import { resolveGlyph } from '@weasel-js/font';
import type { ResolvedRun } from '../runs/resolveRuns';
import type { Entry } from './layoutEntries';

/**
 * One line's entries with each bracket in a right-to-left stretch painting as
 * its mirror (UAX #9 L4). `levels` holds the line's resolved level per entry.
 *
 * The outline tier reads the code point directly; the atlas tiers need the
 * other glyph looked up, which may come from another tier, and a face without
 * it keeps the unmirrored one. The advance stays the one the wrap measured.
 *
 * A shaped entry already shows the mirror when it was shaped right to left.
 * Where that disagrees with its level — a bracket shaped with the text on one
 * side of it and resolved to the direction of the other — it gives up its
 * shaped glyph for its code point's own.
 */
export function mirrorEntries(
  entries: readonly Entry[],
  levels: readonly number[],
  mirror: (cp: number) => number | null,
  runs: readonly ResolvedRun[],
): Entry[] {
  return entries.map((entry, pos) => {
    const odd = levels[pos] % 2 === 1;
    if (entry.shaped !== null && entry.shaped.rtl !== odd) {
      const flipped = mirror(entry.cp);
      if (flipped !== null && flipped !== entry.cp) entry = unshaped(entry, runs[entry.run]);
    }
    if (!odd) return entry;
    if (entry.shaped !== null) return entry;
    const cp = mirror(entry.cp);
    if (cp === null || cp === entry.cp) return entry;
    if (entry.font === null) return { ...entry, cp };
    const run = runs[entry.run];
    const hit = resolveGlyph(entry.resolved, run.fontFamily, run.fontWeight, run.fontStyle, cp, false);
    if (!hit) return entry;
    return { ...entry, cp, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph };
  });
}

/** `entry` drawing its own code point's glyph rather than its shaped cluster: on an atlas, the
 *  glyph's record, which shaping left out. */
function unshaped(entry: Entry, run: ResolvedRun): Entry {
  if (entry.resolved.source === 'outline') return { ...entry, shaped: null };
  const hit = resolveGlyph(entry.resolved, run.fontFamily, run.fontWeight, run.fontStyle, entry.cp, false);
  return hit
    ? { ...entry, shaped: null, resolved: hit.resolved, metrics: hit.metrics, font: hit.font, glyph: hit.glyph }
    : { ...entry, shaped: null };
}
