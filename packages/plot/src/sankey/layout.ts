/** Where a sankey's nodes and ribbons stand: columns by depth, heights by flow, ordered to cross less. */
import type { SankeyData } from './types';

/** One node, placed. */
export interface SankeyNodeBox {
  label: string;
  column: number;
  /** The larger of what flows in and what flows out. */
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One link's ribbon: the span it leaves its source across, and the span it reaches its target across. */
export interface SankeyRibbon {
  source: number;
  target: number;
  from: { x: number; y0: number; y1: number };
  to: { x: number; y0: number; y1: number };
}

/** Where a sankey's parts landed. `nodes` in order of first mention; `links` in the spec's order. */
export interface SankeyLayout {
  nodes: SankeyNodeBox[];
  links: SankeyRibbon[];
  columns: number;
}

/** How wide a node is drawn. */
export const SANKEY_NODE_WIDTH = 12;
const NODE_GAP = 12;
const SWEEPS = 4;

const flowOf = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/** The nodes' labels, in order of first mention. */
export const sankeyNodes = (data: SankeyData): string[] => [...new Set(data.links.flatMap((l) => [l.source, l.target]))];

/** Each node's column: its longest path from a source, with the links that close a cycle left out. */
function depths(n: number, edges: readonly (readonly [number, number])[]): number[] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const [s, t] of edges) out[s]!.push(t);
  const state = new Array<number>(n).fill(0);
  const order: number[] = [];
  const forward: number[][] = Array.from({ length: n }, () => []);
  const visit = (root: number) => {
    const stack: { node: number; next: number }[] = [{ node: root, next: 0 }];
    state[root] = 1;
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const t = out[top.node]![top.next++];
      if (t === undefined) {
        state[top.node] = 2;
        order.push(top.node);
        stack.pop();
      } else if (state[t] !== 1) {
        forward[top.node]!.push(t);
        if (state[t] === 0) {
          state[t] = 1;
          stack.push({ node: t, next: 0 });
        }
      }
    }
  };
  for (let k = 0; k < n; k++) if (state[k] === 0) visit(k);
  const depth = new Array<number>(n).fill(0);
  for (const s of order.reverse()) for (const t of forward[s]!) depth[t] = Math.max(depth[t]!, depth[s]! + 1);
  return depth;
}

/** The nodes in each column, reordered by a few sweeps toward the mean height of their neighbors, each restacked as it is sorted. */
function orderColumns(
  columns: number[][], center: (k: number) => number, edges: readonly (readonly [number, number, number])[], restack: (col: number[]) => void,
): void {
  const sweep = (col: number[], near: (k: number) => (readonly [number, number])[]) => {
    const key = new Map(col.map((k) => {
      const ws = near(k);
      const total = ws.reduce((a, [, w]) => a + w, 0);
      return [k, total > 0 ? ws.reduce((a, [o, w]) => a + center(o) * w, 0) / total : center(k)];
    }));
    col.sort((a, b) => key.get(a)! - key.get(b)!);
    restack(col);
  };
  const into = (k: number) => edges.filter(([, t]) => t === k).map(([s, , w]) => [s, Math.max(w, 1e-9)] as const);
  const outOf = (k: number) => edges.filter(([s]) => s === k).map(([, t, w]) => [t, Math.max(w, 1e-9)] as const);
  for (let i = 0; i < SWEEPS; i++) {
    for (let c = 1; c < columns.length; c++) sweep(columns[c]!, into);
    for (let c = columns.length - 2; c >= 0; c--) sweep(columns[c]!, outOf);
  }
}

/** Lays `data` out in `box`: a column per depth, each node as tall as its flow, ribbons stacked within each node. */
export function sankeyLayout(data: SankeyData, box: { x: number; y: number; width: number; height: number }): SankeyLayout {
  const labels = sankeyNodes(data);
  const index = new Map(labels.map((l, k) => [l, k]));
  const edges = data.links.map((l) => [index.get(l.source)!, index.get(l.target)!, flowOf(l.value)] as const);
  const column = depths(labels.length, edges.map(([s, t]) => [s, t] as const));
  const ins = labels.map((_, k) => edges.filter(([, t]) => t === k).reduce((a, [, , w]) => a + w, 0));
  const outs = labels.map((_, k) => edges.filter(([s]) => s === k).reduce((a, [, , w]) => a + w, 0));
  const value = labels.map((_, k) => Math.max(ins[k]!, outs[k]!));
  const count = labels.length === 0 ? 0 : Math.max(...column) + 1;
  const columns: number[][] = Array.from({ length: count }, (_, c) => labels.flatMap((_, k) => (column[k] === c ? [k] : [])));
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const gap = Math.min(NODE_GAP, box.height / 2 / tallest);
  const ky = Math.max(0, Math.min(...columns.map((c) => {
    const total = c.reduce((a, k) => a + value[k]!, 0);
    return total > 0 ? (box.height - gap * (c.length - 1)) / total : Number.POSITIVE_INFINITY;
  })));
  const scale = Number.isFinite(ky) ? ky : 0;
  const y = new Array<number>(labels.length).fill(0);
  const stack = (col: number[]) => {
    const total = col.reduce((a, k) => a + value[k]! * scale, 0) + gap * (col.length - 1);
    let at = box.y + (box.height - total) / 2;
    for (const k of col) {
      y[k] = at;
      at += value[k]! * scale + gap;
    }
  };
  columns.forEach(stack);
  orderColumns(columns, (k) => y[k]! + (value[k]! * scale) / 2, edges, stack);
  const step = count > 1 ? (box.width - SANKEY_NODE_WIDTH) / (count - 1) : 0;
  const nodes = labels.map((label, k) => ({
    label, column: column[k]!, value: value[k]!, x: box.x + column[k]! * step, y: y[k]!, width: SANKEY_NODE_WIDTH, height: value[k]! * scale,
  }));
  return { nodes, links: ribbons(nodes, edges, scale), columns: count };
}

/** Each link's ribbon, stacked within its source by its target's height and within its target by its source's. */
function ribbons(nodes: readonly SankeyNodeBox[], edges: readonly (readonly [number, number, number])[], scale: number): SankeyRibbon[] {
  const mid = (k: number) => nodes[k]!.y + nodes[k]!.height / 2;
  const offsets = (side: 0 | 1): number[] => {
    const at = new Array<number>(edges.length).fill(0);
    nodes.forEach((node, k) => {
      const mine = edges.map((e, i) => ({ e, i })).filter(({ e }) => e[side] === k);
      mine.sort((a, b) => mid(a.e[1 - side]!) - mid(b.e[1 - side]!) || a.i - b.i);
      let y = node.y;
      for (const { e, i } of mine) {
        at[i] = y;
        y += e[2] * scale;
      }
    });
    return at;
  };
  const leave = offsets(0);
  const reach = offsets(1);
  return edges.map(([s, t, w], i) => {
    const h = w * scale;
    return {
      source: s,
      target: t,
      from: { x: nodes[s]!.x + nodes[s]!.width, y0: leave[i]!, y1: leave[i]! + h },
      to: { x: nodes[t]!.x, y0: reach[i]!, y1: reach[i]! + h },
    };
  });
}
