/**
 * Pinned nodes after the first, held where their author put them. The first
 * pin anchors the layout (see `anchorOffset`); each other one keeps its place
 * across its rank, with the rest of the rank pushed clear of it, and the gap
 * on the anchor's side of its rank stretches or shrinks until the rank's band
 * covers it.
 */
import type { Graph } from '../graph';
import { extent, worldOf, type LayoutAxes } from '../layout';
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
  /** The least a gap may shrink to, to reach a pin. */
  minGap: number;
}

/** What {@link holdPins} works out. */
export interface HeldPins {
  crossAt: Map<string, number>;
  gaps: number[];
  /** The low corner along the rank axis of each pin held, in place of the
   *  centered one its rank's band gives. */
  rankAt: Map<string, number>;
  /** Pins after the first that the layout could not be built around. */
  unheld: Set<string>;
}

const EPS = 1e-6;

/**
 * A pin cannot be held when holding it would shrink a gap below `minGap`,
 * when its rank already holds another pin at a place the band does not
 * cover, or when its rank cannot fit its neighbors between it and another pin
 * there.
 */
export function holdPins(input: PinInput): HeldPins {
  const { graph, rows, axes, pinned } = input;
  const gaps = [...input.gaps];
  const rankAt = new Map<string, number>();
  const unheld = new Set<string>();
  const rowOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rowOf.set(n.id, r)));
  const pins = graph.nodes.filter((n) => pinned.has(n.id) && rowOf.has(n.id));
  if (pins.length < 2) return { crossAt: new Map(input.crossAt), gaps, rankAt, unheld };

  const depths = rows.map((row) => depthOf(row, axes));
  const starts = (): number[] => {
    const out: number[] = [];
    let along = 0;
    for (const [i, depth] of depths.entries()) {
      out.push(along);
      along += depth + (gaps[i] ?? 0);
    }
    return out;
  };
  const anchor = pins[0]!;
  const a = rowOf.get(anchor.id)!;
  const anchorExt = extent(anchor.bounds, axes.rank);
  /** Where a pin's low corners sit in the canonical frame, given the anchor's. */
  const target = (id: string): { cross: number; rank: number } => {
    const along = starts();
    const world = worldOf({ cross: input.crossAt.get(anchor.id)!, rank: along[a]! + (depths[a]! - anchorExt) / 2 }, anchorExt, axes);
    const node = graph.node(id)!;
    const x = node.bounds.x - (anchor.bounds.x - world.x);
    const y = node.bounds.y - (anchor.bounds.y - world.y);
    const ext = extent(node.bounds, axes.rank);
    const rankWorld = axes.rank === 'x' ? x : y;
    return { cross: axes.cross === 'x' ? x : y, rank: axes.sign === 1 ? rankWorld : -rankWorld - ext };
  };

  // Nearest the anchor first, so a stretch never moves a pin already held.
  const rest = pins.slice(1).sort((p, q) => Math.abs(rowOf.get(p.id)! - a) - Math.abs(rowOf.get(q.id)! - a));
  const fixedRows = new Set([a]);
  const held = new Map<string, number>([[anchor.id, input.crossAt.get(anchor.id)!]]);
  const crossAt = new Map(input.crossAt);
  for (const pin of rest) {
    const r = rowOf.get(pin.id)!;
    const ext = extent(pin.bounds, axes.rank);
    const lo = starts()[r]!;
    const hi = lo + depths[r]!;
    const { rank } = target(pin.id);
    const g = r > a ? r - 1 : r;
    let stretch = 0;
    if (rank < lo - EPS || rank + ext > hi + EPS) {
      // Just far enough for the band to cover the pin: positive moves it
      // away from the anchor's, negative toward it.
      const past = rank + ext > hi + EPS;
      stretch = r > a ? (past ? rank + ext - hi : rank - lo) : past ? hi - rank - ext : lo - rank;
      if (fixedRows.has(r) || gaps[g]! + stretch < input.minGap - EPS) {
        unheld.add(pin.id);
        continue;
      }
    }
    gaps[g]! += stretch;
    const at = target(pin.id);
    held.set(pin.id, at.cross);
    if (!settleRow(rows[r]!, crossAt, input.crossAt, held, input)) {
      held.delete(pin.id);
      gaps[g]! -= stretch;
      unheld.add(pin.id);
      continue;
    }
    fixedRows.add(r);
    rankAt.set(pin.id, at.rank);
  }
  return { crossAt, gaps, rankAt, unheld };
}

/**
 * Lay one rank out across, with its held pins where they are and everything
 * else as near its preferred place as keeping clear of them allows, in the
 * order the pins' places put them. Writes into `out` and answers `true`, or
 * answers `false` and writes nothing when the pins leave too little room.
 */
function settleRow(
  row: Rows[number],
  out: Map<string, number>,
  preferred: ReadonlyMap<string, number>,
  held: ReadonlyMap<string, number>,
  input: PinInput,
): boolean {
  const size = (id: string) => extent(row.find((n) => n.id === id)!.bounds, input.axes.cross);
  const at = (id: string) => held.get(id) ?? preferred.get(id)!;
  const order = row.map((n) => n.id).sort((p, q) => at(p) + size(p) / 2 - (at(q) + size(q) / 2));
  const xs = order.map(at);
  const fixed = order.map((id) => held.has(id));
  const sep = (i: number) => size(order[i]!) + input.nodeGap;

  // Pushed clear of what comes before, then pulled clear of what comes after.
  // Only a stretch between two pins too full for what sits in it is left
  // overlapping, since one pin alone has room on both sides.
  for (let i = 1; i < order.length; i++) if (!fixed[i]) xs[i] = Math.max(xs[i]!, xs[i - 1]! + sep(i - 1));
  for (let i = order.length - 2; i >= 0; i--) if (!fixed[i]) xs[i] = Math.min(xs[i]!, xs[i + 1]! - sep(i));
  for (let i = 1; i < order.length; i++) {
    if (xs[i]! < xs[i - 1]! + sep(i - 1) - EPS) return false;
  }
  for (const [i, id] of order.entries()) out.set(id, xs[i]!);
  return true;
}
