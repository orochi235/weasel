/**
 * Which connectors cross from one page to another: each end's page in, splits
 * and their refs out. Nothing here reads a scene.
 */
import type { OffPageSplit } from './trait';

/** One connector as {@link offPageSplits} reads it: the page each end is on (`pageOfNode`), `null` for one on
 *  none, and the split it holds now, if any. */
export interface OffPageEdgeInput {
  id: string;
  fromPage: string | null;
  toPage: string | null;
  offPage?: OffPageSplit | undefined;
}

/** What {@link offPageSplits} reads. */
export interface OffPageSplitInput {
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
 * when its two ends are on different pages; an end on no page never splits.
 * A split keeps the ref it holds while no earlier connector here or `used`
 * holds it too; a new one takes the next free ref.
 */
export function offPageSplits(input: OffPageSplitInput): Map<string, OffPageSplit | null> {
  const used = new Set(input.used ?? []);
  const out = new Map<string, OffPageSplit | null>();
  const fresh: { id: string; from: string; to: string }[] = [];
  for (const { id, fromPage: from, toPage: to, offPage } of input.edges) {
    if (from === null || to === null || from === to) {
      out.set(id, null);
      continue;
    }
    const held = offPage?.ref;
    if (held !== undefined && !used.has(held)) {
      used.add(held);
      out.set(id, { ref: held, from, to });
    } else {
      out.set(id, null);
      fresh.push({ id, from, to });
    }
  }
  for (const split of fresh) {
    const ref = nextOffPageRef(used);
    used.add(ref);
    out.set(split.id, { ref, from: split.from, to: split.to });
  }
  return out;
}
