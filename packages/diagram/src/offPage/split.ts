/**
 * Which connectors cross from one page to another, as arithmetic: page
 * rects and end boxes in, splits out. Nothing here reads a scene.
 */
import { pageOfBounds, type PlacedPage } from '@weasel-js/core';
import type { OffPageSplit } from './trait';

type Box = { x: number; y: number; width: number; height: number };

/** One connector as {@link offPageSplits} reads it: its two ends' world boxes,
 *  and the split it holds now, if any. */
export interface OffPageEdgeInput {
  id: string;
  from: Box;
  to: Box;
  offPage?: OffPageSplit | undefined;
}

/** What {@link offPageSplits} reads. */
export interface OffPageSplitInput {
  pages: readonly PlacedPage[];
  edges: readonly OffPageEdgeInput[];
  /** Refs held by split connectors not in `edges`, which no edge here may take. */
  used?: Iterable<string>;
}

/** The letters of the `n`th ref, counting from 0: A…Z, then AA, AB, … */
function refAt(n: number): string {
  let out = '';
  for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) out = String.fromCharCode(65 + ((k - 1) % 26)) + out;
  return out;
}

/** The first ref, in A…Z, AA… order, that `used` does not hold. */
export function nextOffPageRef(used: ReadonlySet<string>): string {
  let n = 0;
  while (used.has(refAt(n))) n++;
  return refAt(n);
}

/**
 * Each connector's split, or `null` where it stays whole. A connector splits
 * when its two ends belong to different pages (`pageOfBounds`); an end in a
 * gap belongs to none, and never splits. A split keeps the ref it holds while
 * no earlier connector here or `used` holds it too; a new one takes the next
 * free ref.
 */
export function offPageSplits(input: OffPageSplitInput): Map<string, OffPageSplit | null> {
  const used = new Set(input.used ?? []);
  const out = new Map<string, OffPageSplit | null>();
  const fresh: { id: string; from: string; to: string }[] = [];
  for (const edge of input.edges) {
    const from = pageOfBounds(input.pages, edge.from);
    const to = pageOfBounds(input.pages, edge.to);
    if (from === null || to === null || from.id === to.id) {
      out.set(edge.id, null);
      continue;
    }
    const held = edge.offPage?.ref;
    if (held !== undefined && !used.has(held)) {
      used.add(held);
      out.set(edge.id, { ref: held, from: from.id, to: to.id });
    } else {
      out.set(edge.id, null);
      fresh.push({ id: edge.id, from: from.id, to: to.id });
    }
  }
  for (const split of fresh) {
    const ref = nextOffPageRef(used);
    used.add(ref);
    out.set(split.id, { ref, from: split.from, to: split.to });
  }
  return out;
}
