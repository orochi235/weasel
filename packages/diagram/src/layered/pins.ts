/**
 * Pinned nodes after the first, held where their author put them. The first
 * pin anchors the layout (see `anchorOffset`); each other one keeps its place
 * across its rank, with everything else kept clear of it (see `settleAcross`),
 * and its rank's band moves or deepens until it covers the pin.
 */
import type { Graph } from '../graph';
import { extent, worldOf, type LayoutAxes } from '../layout';
import { settleAcross } from './across';
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

const EPS = 1e-6;

/** Where each rank's band sits along the rank axis. The anchor's band starts
 *  at `aStart`; the others follow from the depths and gaps outward from it,
 *  so deepening a band moves only the ranks beyond it. */
interface Bands {
  depths: number[];
  gaps: number[];
  aStart: number;
  /** The anchor's rank. */
  a: number;
}

function startsOf(b: Bands): number[] {
  const out: number[] = [];
  out[b.a] = b.aStart;
  for (let r = b.a + 1; r < b.depths.length; r++) out[r] = out[r - 1]! + b.depths[r - 1]! + b.gaps[r - 1]!;
  for (let r = b.a - 1; r >= 0; r--) out[r] = out[r + 1]! - b.gaps[r]! - b.depths[r]!;
  return out;
}

/**
 * A pin cannot be held when its rank's band cannot reach it: covering it
 * would bring that band nearer the anchor's side than every gap between it and
 * the nearest rank already holding a pin can give, each keeping its least; or
 * when keeping a group's column whole leaves no room for it across (see
 * `settleAcross`).
 */
export function holdPins(input: PinInput): HeldPins {
  const { graph, rows, axes, pinned } = input;
  const bands: Bands = { depths: rows.map((row) => depthOf(row, axes)), gaps: [...input.gaps], aStart: 0, a: 0 };
  const rankAt = new Map<string, number>();
  const unheld = new Set<string>();
  const rowOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rowOf.set(n.id, r)));
  const pins = graph.nodes.filter((n) => pinned.has(n.id) && rowOf.has(n.id));
  if (pins.length < 2) return { crossAt: new Map(input.crossAt), gaps: bands.gaps, depths: bands.depths, rankAt, unheld };

  const anchor = pins[0]!;
  const a = rowOf.get(anchor.id)!;
  bands.a = a;
  for (let r = 0; r < a; r++) bands.aStart += bands.depths[r]! + bands.gaps[r]!;
  const anchorExt = extent(anchor.bounds, axes.rank);
  const anchorRank = bands.aStart + (bands.depths[a]! - anchorExt) / 2;
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

  // Nearest the anchor first, so moving a band never moves a pin already held.
  const rest = pins.slice(1).sort((p, q) => Math.abs(rowOf.get(p.id)! - a) - Math.abs(rowOf.get(q.id)! - a));
  const fixedRows = new Set([a]);
  const held = new Map<string, number>([[anchor.id, input.crossAt.get(anchor.id)!]]);
  const ranks = new Map<string, number>([[anchor.id, anchorRank]]);
  let crossAt = new Map(input.crossAt);
  for (const pin of rest) {
    const r = rowOf.get(pin.id)!;
    const at = target(pin.id);
    const lo = startsOf(bands)[r]!;
    const below = lo - at.rank;
    const above = at.rank + extent(pin.bounds, axes.rank) - (lo + bands.depths[r]!);
    const saved = { depths: [...bands.depths], gaps: [...bands.gaps], aStart: bands.aStart };
    if (!reach(bands, r, fixedRows, Math.max(0, below), Math.max(0, above), input.minGaps)) {
      Object.assign(bands, saved);
      unheld.add(pin.id);
      continue;
    }
    held.set(pin.id, at.cross);
    const settled = settleAcross({ graph, rows, preferred: input.crossAt, held, axes, nodeGap: input.nodeGap });
    if (settled === undefined) {
      held.delete(pin.id);
      Object.assign(bands, saved);
      unheld.add(pin.id);
      continue;
    }
    crossAt = settled;
    fixedRows.add(r);
    ranks.set(pin.id, at.rank);
  }
  const first = startsOf(bands)[0]!;
  for (const [id, rank] of ranks) rankAt.set(id, rank - first);
  return { crossAt, gaps: bands.gaps, depths: bands.depths, rankAt, unheld };
}

/**
 * Move or deepen rank `r`'s band until it reaches `below` further toward the
 * low end and `above` further toward the high end. A rank holding no pin yet
 * moves whole; one already holding a pin, which must stay covered, deepens.
 * Answers `false` when the side toward the anchor cannot get that far.
 */
function reach(bands: Bands, r: number, fixedRows: ReadonlySet<number>, below: number, above: number, minGaps: readonly number[]): boolean {
  const { a } = bands;
  if (r === a) {
    bands.aStart -= below;
    bands.depths[a]! += below + above;
    return true;
  }
  const near = r > a ? below : above;
  const far = r > a ? above : below;
  if (near > EPS && !shrinkToward(bands, r, fixedRows, near, minGaps)) return false;
  if (fixedRows.has(r)) bands.depths[r]! += near + far;
  else bands.gaps[r > a ? r - 1 : r]! += far;
  return true;
}

/**
 * Bring rank `r` `by` nearer the anchor by shrinking the gaps between it and
 * the nearest rank holding a pin, each in proportion to what it has above
 * its least.
 */
function shrinkToward(bands: Bands, r: number, fixedRows: ReadonlySet<number>, by: number, minGaps: readonly number[]): boolean {
  const step = r > bands.a ? -1 : 1;
  let f = r + step;
  while (!fixedRows.has(f)) f += step;
  const between: number[] = [];
  for (let k = Math.min(r, f); k < Math.max(r, f); k++) between.push(k);
  const slack = (k: number) => Math.max(0, bands.gaps[k]! - minGaps[k]!);
  const total = between.reduce((sum, k) => sum + slack(k), 0);
  if (total < by - EPS) return false;
  for (const k of between) bands.gaps[k]! -= (by * slack(k)) / total;
  return true;
}
