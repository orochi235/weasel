/** Ranking by network simplex (Gansner, Koutsofios, North and Vo, 1993: "A
 *  Technique for Drawing Directed Graphs", the ranking Graphviz dot uses). */
import type { Graph } from '../graph';

/** An edge between two nodes of one component, by their index in it: at
 *  least `minlen` ranks long, its length counting `weight` times. */
interface Arc {
  tail: number;
  head: number;
  weight: number;
  minlen: number;
}

/** What a rank of span costs a group, per member: enough that a group sits in
 *  one rank whenever its members' edges let it at any reasonable price. */
const GROUP_WEIGHT = 4;

/** A connected component: its nodes' graph indices in graph order, and its
 *  arcs in edge order, naming nodes by their position in `nodes`. */
interface Part {
  nodes: number[];
  arcs: Arc[];
}

/**
 * Each node's rank, chosen to make the total edge length as short as it can:
 * the sum over edges of `rank(to) - rank(from)`, with every edge at least one
 * rank long and every edge weighing the same.
 *
 * An edge in `back` counts as running the other way, so it is ranked and kept
 * forward like any other; a self-loop is ignored; parallel edges each count.
 * A group's members are also drawn into as few ranks as they can share: each
 * rank between its first member's and its last costs every member
 * `GROUP_WEIGHT` edge lengths, so a group sits in one rank unless an edge
 * between its members, or a much longer route elsewhere, needs more. Each
 * connected component, joining a group's members as one, is ranked on its own
 * and starts at rank 0.
 *
 * Starts from the longest-path ranking and improves it by network simplex,
 * stopping after a number of rounds proportional to the edge count. Every
 * round leaves a valid ranking, so the answer is valid even when the cap is
 * hit. Ties break by graph order — node index, then edge index — so the same
 * graph always ranks the same.
 *
 * If `back` leaves a cycle, no valid ranking exists; that component keeps its
 * longest-path start, which `ranksOf` would also give.
 */
export function ranksByLength(graph: Graph, back: ReadonlySet<string>): Map<string, number> {
  const index = new Map<string, number>();
  graph.nodes.forEach((node, i) => index.set(node.id, i));
  const arcs: Arc[] = [];
  for (const edge of graph.edges) {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (from === undefined || to === undefined || from === to) continue;
    arcs.push(back.has(edge.id) ? { tail: to, head: from, weight: 1, minlen: 1 } : { tail: from, head: to, weight: 1, minlen: 1 });
  }
  // A group spans the ranks from a node above all its members to one below
  // them, both standing in for the group's box and nothing else.
  let count = graph.nodes.length;
  for (const group of graph.groups ?? []) {
    const members = [...new Set(group.members.map((id) => index.get(id)).filter((i): i is number => i !== undefined))];
    if (members.length < 2) continue;
    const [top, bottom] = [count, count + 1];
    count += 2;
    for (const m of members) {
      arcs.push({ tail: top, head: m, weight: GROUP_WEIGHT, minlen: 0 });
      arcs.push({ tail: m, head: bottom, weight: GROUP_WEIGHT, minlen: 0 });
    }
  }

  const real = graph.nodes.length;
  const start = longestPath(count, arcs);
  const ranks = new Map<string, number>();
  for (const part of components(count, arcs)) {
    const rank = part.nodes.map((g) => start[g]!);
    simplex(part.arcs, rank);
    const own = part.nodes.flatMap((g, i) => (g < real ? [i] : []));
    const min = Math.min(...own.map((i) => rank[i]!));
    for (const i of own) ranks.set(graph.nodes[part.nodes[i]!]!.id, rank[i]! - min);
  }
  return ranks;
}

/** Longest-path ranks over `arcs`, by a topological walk in index order. Nodes
 *  on a cycle are never reached and keep whatever their ranked predecessors
 *  gave them. */
function longestPath(count: number, arcs: readonly Arc[]): number[] {
  const rank = new Array<number>(count).fill(0);
  const pending = new Array<number>(count).fill(0);
  const out: Arc[][] = Array.from({ length: count }, () => []);
  for (const arc of arcs) {
    pending[arc.head]!++;
    out[arc.tail]!.push(arc);
  }
  const ready: number[] = [];
  for (let i = 0; i < count; i++) if (pending[i] === 0) ready.push(i);
  for (let k = 0; k < ready.length; k++) {
    const u = ready[k]!;
    for (const { head: v, minlen } of out[u]!) {
      rank[v] = Math.max(rank[v]!, rank[u]! + minlen);
      if (--pending[v]! === 0) ready.push(v);
    }
  }
  return rank;
}

/** The connected components, ignoring direction, each led by its first node in
 *  graph order. */
function components(count: number, arcs: readonly Arc[]): Part[] {
  const near: number[][] = Array.from({ length: count }, () => []);
  for (const arc of arcs) {
    near[arc.tail]!.push(arc.head);
    near[arc.head]!.push(arc.tail);
  }
  const part = new Array<number>(count).fill(-1);
  const parts: Part[] = [];
  for (let seed = 0; seed < count; seed++) {
    if (part[seed] !== -1) continue;
    const id = parts.length;
    const found = [seed];
    part[seed] = id;
    for (let k = 0; k < found.length; k++) {
      for (const v of near[found[k]!]!) {
        if (part[v] === -1) {
          part[v] = id;
          found.push(v);
        }
      }
    }
    parts.push({ nodes: found.sort((a, b) => a - b), arcs: [] });
  }
  const local = new Array<number>(count);
  for (const p of parts) p.nodes.forEach((g, i) => (local[g] = i));
  for (const arc of arcs) {
    parts[part[arc.tail]!]!.arcs.push({ ...arc, tail: local[arc.tail]!, head: local[arc.head]! });
  }
  return parts;
}

const slackOf = (arc: Arc, rank: readonly number[]): number => rank[arc.head]! - rank[arc.tail]! - arc.minlen;

/** Network simplex over one component, improving `rank` in place. */
function simplex(arcs: readonly Arc[], rank: number[]): void {
  if (arcs.length === 0 || arcs.some((arc) => slackOf(arc, rank) < 0)) return;
  const inTree = feasibleTree(arcs, rank);
  const cap = 4 * arcs.length + 100;
  // Each pivot changes the weighted total by (cut value × entering slack) ≤ 0, so the
  // last ranking is the best one seen.
  for (let round = 0; round < cap; round++) {
    const tree = postorder(rank.length, arcs, inTree);
    let leave = -1;
    let tailInside = false;
    for (let a = 0; a < arcs.length && leave === -1; a++) {
      if (!inTree[a]) continue;
      const cut = cutValue(arcs, a, tree);
      if (cut.value < 0) {
        leave = a;
        tailInside = cut.tailInside;
      }
    }
    if (leave === -1) return;
    const inside = insideOf(tree, childOf(arcs[leave]!, leave, tree));
    let enter = -1;
    for (let a = 0; a < arcs.length; a++) {
      const arc = arcs[a]!;
      if (inTree[a]) continue;
      // The entering arc runs from the leaving arc's head side to its tail side.
      const crosses = tailInside
        ? !inside(arc.tail) && inside(arc.head)
        : inside(arc.tail) && !inside(arc.head);
      if (crosses && (enter === -1 || slackOf(arc, rank) < slackOf(arcs[enter]!, rank))) enter = a;
    }
    if (enter === -1) return;
    inTree[leave] = false;
    inTree[enter] = true;
    tighten(rank, arcs, inTree);
  }
}

/** A spanning tree of tight arcs (slack 0), shifting ranks to make one where
 *  the start has none. Returns which arcs are in it. */
function feasibleTree(arcs: readonly Arc[], rank: number[]): boolean[] {
  const inTree = arcs.map(() => false);
  const has = rank.map(() => false);
  has[0] = true;
  let size = 1;
  const grow = (): void => {
    for (let changed = true; changed; ) {
      changed = false;
      arcs.forEach((arc, a) => {
        if (has[arc.tail] === has[arc.head] || slackOf(arc, rank) !== 0) return;
        inTree[a] = true;
        has[arc.tail] = has[arc.head] = true;
        size++;
        changed = true;
      });
    }
  };
  grow();
  while (size < rank.length) {
    let best = -1;
    arcs.forEach((arc, a) => {
      if (has[arc.tail] === has[arc.head]) return;
      if (best === -1 || slackOf(arc, rank) < slackOf(arcs[best]!, rank)) best = a;
    });
    const arc = arcs[best]!;
    const delta = has[arc.head] ? -slackOf(arc, rank) : slackOf(arc, rank);
    for (let v = 0; v < rank.length; v++) if (has[v]) rank[v] += delta;
    grow();
  }
  return inTree;
}

/** The tree rooted at node 0: each node's postorder number `lim`, the lowest
 *  `lim` in its subtree `low`, and the arc to its parent (-1 at the root). */
interface Rooted {
  low: number[];
  lim: number[];
  parentArc: number[];
}

function treeAdjacency(count: number, arcs: readonly Arc[], inTree: readonly boolean[]): number[][] {
  const adj: number[][] = Array.from({ length: count }, () => []);
  arcs.forEach((arc, a) => {
    if (!inTree[a]) return;
    adj[arc.tail]!.push(a);
    adj[arc.head]!.push(a);
  });
  return adj;
}

function postorder(count: number, arcs: readonly Arc[], inTree: readonly boolean[]): Rooted {
  const adj = treeAdjacency(count, arcs, inTree);
  const low = new Array<number>(count).fill(0);
  const lim = new Array<number>(count).fill(0);
  const parentArc = new Array<number>(count).fill(-1);
  let next = 1;
  const stack: { v: number; i: number }[] = [{ v: 0, i: 0 }];
  low[0] = next;
  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    const a = adj[top.v]![top.i++];
    if (a === undefined) {
      lim[top.v] = next++;
      stack.pop();
      continue;
    }
    if (a === parentArc[top.v]) continue;
    const arc = arcs[a]!;
    const w = arc.tail === top.v ? arc.head : arc.tail;
    parentArc[w] = a;
    low[w] = next;
    stack.push({ v: w, i: 0 });
  }
  return { low, lim, parentArc };
}

function childOf(arc: Arc, a: number, tree: Rooted): number {
  return tree.parentArc[arc.tail] === a ? arc.tail : arc.head;
}

function insideOf(tree: Rooted, child: number): (v: number) => boolean {
  const lo = tree.low[child]!;
  const hi = tree.lim[child]!;
  return (v) => lo <= tree.lim[v]! && tree.lim[v]! <= hi;
}

/** Tree arc `a`'s cut value: the weight of arcs crossing from its tail's side
 *  to its head's, less that of those crossing back. */
function cutValue(arcs: readonly Arc[], a: number, tree: Rooted): { value: number; tailInside: boolean } {
  const treeArc = arcs[a]!;
  const child = childOf(treeArc, a, tree);
  const inside = insideOf(tree, child);
  const tailInside = child === treeArc.tail;
  let value = 0;
  for (const arc of arcs) {
    const from = inside(arc.tail);
    if (from === inside(arc.head)) continue;
    value += from === tailInside ? arc.weight : -arc.weight;
  }
  return { value, tailInside };
}

/** Re-ranks so every tree arc is as short as it may be, holding node 0 where it is. */
function tighten(rank: number[], arcs: readonly Arc[], inTree: readonly boolean[]): void {
  const adj = treeAdjacency(rank.length, arcs, inTree);
  const seen = rank.map(() => false);
  seen[0] = true;
  const queue = [0];
  for (let k = 0; k < queue.length; k++) {
    const v = queue[k]!;
    for (const a of adj[v]!) {
      const arc = arcs[a]!;
      const w = arc.tail === v ? arc.head : arc.tail;
      if (seen[w]) continue;
      seen[w] = true;
      rank[w] = arc.tail === v ? rank[v]! + arc.minlen : rank[v]! - arc.minlen;
      queue.push(w);
    }
  }
}
