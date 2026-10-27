/**
 * The groups a painting sorts its glyphs into, and the groups of paintings
 * nobody can reach any more, refilled by the next.
 */
import type { FontStyle } from '@weasel-js/font';
import { paintKey, strokeHasInk, strokeKey, type Stroke } from '@weasel-js/paint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { quadsViewed, quadViews } from './glyphQuads';
import type { PlacedGlyph } from './layoutRuns';
import type { LaidOutGroup } from './paintRuns';

/** The group the previous glyph joined, and every input it was matched on. */
interface LastGroup {
  group: LaidOutGroup | null;
  run: number; family: string; weight: number; style: FontStyle;
  bold: boolean; italic: boolean; source: LaidOutGroup['source']; page: number;
}

/** A group, the run whose glyph opened it, and what that run paints, as a
 *  string built only when a glyph of another run has to be compared with it. */
interface GroupSlot {
  group: LaidOutGroup;
  run: number;
  paint: string | null;
}

/** What a glyph of `run` on `source` paints with: its fill, and its stroke
 *  where the tier can draw one. */
function strokeOn(run: ResolvedRun, source: LaidOutGroup['source']): Stroke | undefined {
  // Only the outline tier can paint a stroke; an SDF group carrying one would
  // be a promise the renderer cannot keep.
  return source === 'outline' && strokeHasInk(run.stroke) ? run.stroke : undefined;
}

function paintOf(run: ResolvedRun, source: LaidOutGroup['source']): string {
  return `${paintKey(run.fill?.paint)}|${strokeKey(strokeOn(run, source))}`;
}

/** The group `g` joins, of those the painting under way has opened: one
 *  sharing its face, tier, page and paint, or a new one. */
export function groupFor(
  runs: readonly ResolvedRun[],
  g: PlacedGlyph,
  source: LaidOutGroup['source'],
): LaidOutGroup {
  const { family, weight, style } = g.resolved.resolved;
  const { synthetic } = g.resolved;
  const page = source === 'outline' ? 0 : g.glyph!.page;
  // A glyph matching the one before it joins that group without a search.
  if (last.group !== null && last.run === g.run && last.source === source && last.page === page
    && last.family === family && last.weight === weight && last.style === style
    && last.bold === synthetic.bold && last.italic === synthetic.italic) {
    return last.group;
  }
  const run = runs[g.run];
  let group: LaidOutGroup | null = null;
  let paint: string | null = null;
  for (let k = 0; k < slots.length; k++) {
    const slot = slots[k];
    const c = slot.group;
    if (c.source !== source || c.page !== page || c.family !== family || c.weight !== weight
      || c.style !== style || c.synthetic.bold !== synthetic.bold || c.synthetic.italic !== synthetic.italic) continue;
    // One run paints one way, so only a glyph of another run builds the strings.
    if (slot.run !== g.run) {
      paint ??= paintOf(run, source);
      slot.paint ??= paintOf(runs[slot.run], source);
      if (slot.paint !== paint) continue;
    }
    group = c;
    break;
  }
  if (group === null) {
    const stroke = strokeOn(run, source);
    group = stroke === undefined && source !== 'color' ? spareGroups.pop() ?? null : null;
    if (group !== null) {
      group.family = family; group.weight = weight; group.style = style;
      group.synthetic.bold = synthetic.bold; group.synthetic.italic = synthetic.italic;
      group.source = source; group.page = page; group.fill = run.fill;
    } else {
      group = Object.defineProperties({
        family, weight, style, synthetic: { bold: synthetic.bold, italic: synthetic.italic }, source, page,
        fill: run.fill, quadData: NO_QUADS, glyphs: [],
      }, quadViews) as unknown as LaidOutGroup;
      if (stroke) group.stroke = stroke;
      if (source === 'color') group.colorGlyphs = [];
    }
    const i = slots.length;
    let slot = slotPool[i];
    if (slot === undefined) {
      slot = { group, run: g.run, paint };
      if (i < SLOT_POOL_MAX) slotPool[i] = slot;
    } else {
      slot.group = group; slot.run = g.run; slot.paint = paint;
    }
    slots.push(slot);
  }
  last.group = group;
  last.run = g.run; last.family = family; last.weight = weight; last.style = style;
  last.bold = synthetic.bold; last.italic = synthetic.italic; last.source = source; last.page = page;
  return group;
}

/** What a group holds before its first quad: never written to, since the
 *  quad that would be is given an array of its own. */
export const NO_QUADS: readonly number[] = [];

/** Groups of paintings nobody can reach any more, for the next painting's
 *  groups to refill. */
const spareGroups: LaidOutGroup[] = [];
const SPARE_GROUPS_MAX = 1024;

/** Hand `group`, of a painting nobody can reach, to the next painting. Its
 *  quad array is the caller's to have given back already. One with a stroke,
 *  color glyphs, or a built `quads` view is left to the collector. */
export function giveGroup(group: LaidOutGroup): void {
  if (spareGroups.length >= SPARE_GROUPS_MAX || group.stroke !== undefined || group.colorGlyphs !== undefined
    || quadsViewed.has(group)) return;
  group.quadData = NO_QUADS;
  group.glyphs.length = 0;
  spareGroups.push(group);
}

/** The painting under way's groups so far and the one its last glyph joined,
 *  emptied by {@link takeGroups} so they hold no group between paintings. */
const slots: GroupSlot[] = [];
const slotPool: GroupSlot[] = [];
const SLOT_POOL_MAX = 64;
const last: LastGroup = {
  group: null, run: -1, family: '', weight: 0, style: 'normal', bold: false, italic: false, source: 'atlas', page: 0,
};

/** Move the painting under way's groups into `out`, in the order they opened,
 *  and start the next painting with none. */
export function takeGroups(out: LaidOutGroup[]): void {
  for (let i = 0; i < slots.length; i++) {
    out.push(slots[i].group);
    slots[i].group = null as unknown as LaidOutGroup;
  }
  slots.length = 0;
  last.group = null;
}
