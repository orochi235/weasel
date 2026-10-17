import { matchQuery } from '@weasel-js/registry';
import type { IconEntry } from '@weasel-js/icons';

export interface IconGroup {
  group: string;
  entries: readonly IconEntry[];
}

/** The entries a query finds, by qualified name, group or tag, gathered under their group in first-seen order. */
export function groupIcons(entries: readonly IconEntry[], query: string): IconGroup[] {
  const groups = new Map<string, IconEntry[]>();
  for (const e of entries) {
    if (!matchQuery(query, { text: [e.ref, e.glyph.group], tags: e.glyph.tags })) continue;
    const held = groups.get(e.glyph.group);
    if (held) held.push(e);
    else groups.set(e.glyph.group, [e]);
  }
  return [...groups].map(([group, list]) => ({ group, entries: list }));
}

interface Box { top: number; left: number; width: number }

const center = (r: Box) => r.left + r.width / 2;

/** The index reached by one arrow step from `from`: along the order for left and right, to the nearest center in
 *  the next row up or down otherwise. `null` where there is nowhere to go. */
export function stepIndex(boxes: readonly Box[], from: number, key: string): number | null {
  if (key === 'ArrowLeft') return from > 0 ? from - 1 : null;
  if (key === 'ArrowRight') return from < boxes.length - 1 ? from + 1 : null;
  const dir = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (dir === 0) return null;
  const here = boxes[from]!;
  let row: number | null = null;
  let best: number | null = null;
  boxes.forEach((b, i) => {
    if (dir * (b.top - here.top) <= 0.5) return;
    if (row === null || dir * (b.top - row) < -0.5) { row = b.top; best = null; }
    if (Math.abs(b.top - row) > 0.5) return;
    if (best === null || Math.abs(center(b) - center(here)) < Math.abs(center(boxes[best]!) - center(here))) best = i;
  });
  return best;
}
