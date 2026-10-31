/**
 * `tree` with `treeSides: 'both'`: each root's children split between the two
 * sides of it along the rank axis, each side packed as `tree` packs one, its
 * bands of depth counted outward from the root.
 */
import type { Graph, GraphNode } from './graph';
import { extent, type LayoutAxes, type Slot } from './layout';
import { subtreeBlocks, type Forest } from './tree';

/** Where to cut `spans` so the two halves are as near equal as order allows: the count that go first. */
function balancedCut(spans: readonly number[]): number {
  const total = spans.reduce((a, b) => a + b, 0);
  let best = { cut: spans.length, diff: Infinity };
  let first = 0;
  for (let k = 0; k <= spans.length; k++) {
    const diff = Math.abs(first - (total - first));
    if (diff < best.diff) best = { cut: k, diff };
    first += spans[k] ?? 0;
  }
  return best.cut;
}

/** Each node's side, `1` past its root and `-1` before it, and each root's children on each side. */
function sidesOf(forest: Forest, axes: LayoutAxes, gap: number) {
  const side = new Map<string, 1 | -1>();
  const split = new Map<string, { after: GraphNode[]; before: GraphNode[] }>();
  const blocks = subtreeBlocks(forest.children, axes.cross, gap);
  const mark = (node: GraphNode, s: 1 | -1): void => {
    side.set(node.id, s);
    for (const child of forest.children.get(node.id) ?? []) mark(child, s);
  };
  for (const root of forest.roots) {
    const kids = forest.children.get(root.id) ?? [];
    const cut = balancedCut(kids.map((k) => blocks.span(k)));
    const after = kids.slice(0, cut);
    const before = kids.slice(cut);
    split.set(root.id, { after, before });
    side.set(root.id, 1);
    for (const k of after) mark(k, 1);
    for (const k of before) mark(k, -1);
  }
  return { side, split };
}

/** The canonical slot of every node, roots in a row along the cross axis and each side's bands running away from them. */
export function twoSidedSlots(graph: Graph, forest: Forest, axes: LayoutAxes, nodeGap: number, rankGap: number): Map<string, Slot> {
  const { side, split } = sidesOf(forest, axes, nodeGap);
  const bandKey = (id: string) => `${forest.depth.get(id) === 0 ? 0 : side.get(id)}:${forest.depth.get(id) ?? 0}`;
  const bands = new Map<string, number>();
  for (const node of graph.nodes) bands.set(bandKey(node.id), Math.max(bands.get(bandKey(node.id)) ?? 0, extent(node.bounds, axes.rank)));
  const deepest = Math.max(0, ...forest.depth.values());
  const bandStart = new Map<string, number>([['0:0', 0]]);
  let after = (bands.get('0:0') ?? 0) + rankGap;
  let before = -rankGap;
  for (let d = 1; d <= deepest; d++) {
    bandStart.set(`1:${d}`, after);
    after += (bands.get(`1:${d}`) ?? 0) + rankGap;
    before -= bands.get(`-1:${d}`) ?? 0;
    bandStart.set(`-1:${d}`, before);
    before -= rankGap;
  }

  const crossAt = new Map<string, number>();
  let cursor = 0;
  for (const root of forest.roots) {
    const halves = split.get(root.id)!;
    const one = (kids: readonly GraphNode[]) => subtreeBlocks(new Map(forest.children).set(root.id, kids), axes.cross, nodeGap);
    const blocks = [one(halves.after), one(halves.before)];
    const block = Math.max(...blocks.map((b) => b.span(root)));
    for (const b of blocks) b.lay(root, cursor + (block - b.span(root)) / 2, crossAt);
    crossAt.set(root.id, cursor + (block - extent(root.bounds, axes.cross)) / 2);
    cursor += block + nodeGap;
  }

  const slots = new Map<string, Slot>();
  for (const node of graph.nodes) {
    const key = bandKey(node.id);
    slots.set(node.id, { cross: crossAt.get(node.id)!, rank: bandStart.get(key)! + (bands.get(key)! - extent(node.bounds, axes.rank)) / 2 });
  }
  return slots;
}
