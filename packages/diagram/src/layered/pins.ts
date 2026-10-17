/**
 * Pinned nodes after the first, held where their author put them. The first
 * pin anchors the layout (see `anchorOffset`); each other one keeps its place
 * across its rank, with everything else kept clear of it (see `settleAcross`),
 * and its rank's band moves or deepens until it covers the pin.
 */
import type { Graph } from '../graph';
import { extent, worldOf, type LayoutAxes } from '../layout';
import { settleAcross } from './across';
import { placeBands, type BandInput, type Cover } from './bands';
import { depthOf } from './expand';
import type { Rows } from './types';

/** What {@link holdPins} reads. */
export interface PinInput {
  graph: Graph;
  rows: Rows;
  /** Each node's low corner across the rank, placeholders included. */
  crossAt: ReadonlyMap<string, number>;
  /** Between each rank and the next. */
  gaps: readonly number[];
  pinned: ReadonlySet<string>;
  axes: LayoutAxes;
  nodeGap: number;
  /** The least each gap may shrink to, to reach a pin. */
  minGaps: readonly number[];
}

/** What {@link holdPins} works out. */
export interface HeldPins {
  crossAt: Map<string, number>;
  gaps: number[];
  /** Each rank's band along the rank axis: its deepest node's extent, or
   *  more where the band deepened to cover a pin. */
  depths: number[];
  /** The low corner along the rank axis of each pin held, in the frame where
   *  the first rank's band starts at 0, in place of the centered one its
   *  rank's band gives. */
  rankAt: Map<string, number>;
  /** Pins after the first that the layout could not be built around. */
  unheld: Set<string>;
}

/**
 * A pin cannot be held when its rank's band cannot reach it without two
 * ranks' bands coming nearer than their least gap (see `placeBands`), or when
 * a group's column cannot go where its pins put it (see `settleAcross`).
 */
export function holdPins(input: PinInput): HeldPins {
  const { graph, rows, axes, pinned } = input;
  const natural = rows.map((row) => depthOf(row, axes));
  const rankAt = new Map<string, number>();
  const unheld = new Set<string>();
  const rowOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rowOf.set(n.id, r)));
  const pins = graph.nodes.filter((n) => pinned.has(n.id) && rowOf.has(n.id));
  if (pins.length < 2) return { crossAt: new Map(input.crossAt), gaps: [...input.gaps], depths: natural, rankAt, unheld };

  const anchor = pins[0]!;
  const a = rowOf.get(anchor.id)!;
  let start = 0;
  for (let r = 0; r < a; r++) start += natural[r]! + input.gaps[r]!;
  const bandInput: BandInput = { natural, gaps: input.gaps, minGaps: input.minGaps, home: { rank: a, lo: start } };
  const anchorExt = extent(anchor.bounds, axes.rank);
  const anchorRank = start + (natural[a]! - anchorExt) / 2;
  const anchorWorld = worldOf({ cross: input.crossAt.get(anchor.id)!, rank: anchorRank }, anchorExt, axes);
  /** Where a pin's low corners sit in the canonical frame, given the anchor's. */
  const target = (id: string): { cross: number; rank: number } => {
    const node = graph.node(id)!;
    const x = node.bounds.x - (anchor.bounds.x - anchorWorld.x);
    const y = node.bounds.y - (anchor.bounds.y - anchorWorld.y);
    const ext = extent(node.bounds, axes.rank);
    const rankWorld = axes.rank === 'x' ? x : y;
    return { cross: axes.cross === 'x' ? x : y, rank: axes.sign === 1 ? rankWorld : -rankWorld - ext };
  };

  // Nearest the anchor first, so a pin far off cannot crowd out a near one.
  const rest = pins.slice(1).sort((p, q) => Math.abs(rowOf.get(p.id)! - a) - Math.abs(rowOf.get(q.id)! - a));
  const held = new Map<string, number>([[anchor.id, input.crossAt.get(anchor.id)!]]);
  const ranks = new Map<string, number>([[anchor.id, anchorRank]]);
  let covers = new Map<number, Cover>([[a, { lo: anchorRank, hi: anchorRank + anchorExt }]]);
  let placed = placeBands(bandInput, covers)!;
  let crossAt = new Map(input.crossAt);
  for (const pin of rest) {
    const r = rowOf.get(pin.id)!;
    const at = target(pin.id);
    const was = covers.get(r);
    const hi = at.rank + extent(pin.bounds, axes.rank);
    const next = new Map(covers).set(r, { lo: Math.min(was?.lo ?? at.rank, at.rank), hi: Math.max(was?.hi ?? hi, hi) });
    const bands = placeBands(bandInput, next);
    const settled = bands && settleAcross({ graph, rows, preferred: input.crossAt, held: new Map(held).set(pin.id, at.cross), axes, nodeGap: input.nodeGap });
    if (bands === undefined || settled === undefined) {
      unheld.add(pin.id);
      continue;
    }
    held.set(pin.id, at.cross);
    ranks.set(pin.id, at.rank);
    [covers, placed, crossAt] = [next, bands, settled];
  }
  const { los, his } = placed;
  for (const [id, rank] of ranks) rankAt.set(id, rank - los[0]!);
  const gaps = los.slice(1).map((lo, k) => lo - his[k]!);
  return { crossAt, gaps, depths: los.map((lo, k) => his[k]! - lo), rankAt, unheld };
}
