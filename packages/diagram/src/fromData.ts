/**
 * `diagramScene` — a laid-out diagram from plain `{ nodes, edges }`.
 *
 * Sizes are estimated from character counts, not measured, so layout runs
 * without a canvas and gives the same answer in node and in a browser.
 */
import type { AddNodeSpec, RectPose, Stroke } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, type DiagramEdge } from './edge';
import type { Graph, GraphEdge, GraphNode } from './graph';
import { LABEL_DERIVE_POSE, type DiagramLabel } from './label';
import { layered } from './layered';
import type { LayoutFn, LayoutOptions } from './layout';
import type { DiagramNode } from './types';

export interface DataNode { id: string; lines: readonly string[] }
export interface DataEdge { from: string; to: string; label?: string }
export interface DiagramData { nodes: readonly DataNode[]; edges: readonly DataEdge[] }
export interface NodeStyle { fill: string; stroke: string; text: string; strokeWidth?: number }
export interface EdgeStyle { stroke: string; width?: number }

export interface DiagramSceneData {
  diagram?: DiagramNode | DiagramEdge | { label: DiagramLabel };
  fill?: { color: string };
  stroke?: Stroke;
  text?: string;
  style?: { fontFamily: string; fontSize: number };
}

export type DiagramSpec = AddNodeSpec<DiagramSceneData, 'main', RectPose>;

export interface DiagramSceneOptions {
  layout?: LayoutFn;
  layoutOptions?: LayoutOptions;
  router?: 'straight' | 'bezier' | 'orthogonal';
  font?: { fontFamily: string; fontSize: number };
  nodeStyle?: (node: DataNode) => NodeStyle;
  edgeStyle?: (edge: DataEdge) => EdgeStyle;
}

const FONT = { fontFamily: 'sans-serif', fontSize: 12 };
const NODE: NodeStyle = { fill: '#16222c', stroke: '#7ba7c7', text: '#dbe7f2' };
const EDGE: EdgeStyle = { stroke: '#7ba7c7' };
const PAD = { x: 12, y: 8 };
const LINE = 1.4;
const GLYPH = 0.6;
const MIN_WIDTH = 64;

export const edgeIdOf = (e: DataEdge) => `edge:${e.from}->${e.to}${e.label ? `:${e.label}` : ''}`;

function sizeOf(node: DataNode, fontSize: number) {
  const longest = Math.max(0, ...node.lines.map((l) => l.length));
  return {
    width: Math.max(MIN_WIDTH, Math.ceil(longest * GLYPH * fontSize + 2 * PAD.x)),
    height: Math.ceil(Math.max(1, node.lines.length) * LINE * fontSize + 2 * PAD.y),
  };
}

function graphOf(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, GraphEdge[]>();
  const inc = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    inc.set(e.to, [...(inc.get(e.to) ?? []), e]);
  }
  return {
    nodes,
    edges,
    node: (id) => byId.get(id),
    outgoing: (id) => out.get(id) ?? [],
    incoming: (id) => inc.get(id) ?? [],
  };
}

/** Throws on a repeated node id, which names two nodes as one. An edge whose
 *  end is not a node is dropped, and so is a repeat of an earlier edge with
 *  the same ends and label: it would draw exactly on top of the first. */
export function diagramScene(data: DiagramData, opts: DiagramSceneOptions = {}): DiagramSpec[] {
  const font = opts.font ?? FONT;
  const ids = new Set<string>();
  for (const n of data.nodes) {
    if (ids.has(n.id)) throw new Error(`diagramScene: node id "${n.id}" appears more than once`);
    ids.add(n.id);
  }
  const seen = new Set<string>();
  const edges = data.edges.filter((e) => {
    const id = edgeIdOf(e);
    if (seen.has(id) || !ids.has(e.from) || !ids.has(e.to)) return false;
    seen.add(id);
    return true;
  });
  // Seeded on the diagonal in source order, so whichever axis a layout reads
  // for in-rank order, it starts from the data's own order.
  const seeds: GraphNode[] = data.nodes.map((n, i) => ({
    id: n.id,
    bounds: { x: i, y: i, ...sizeOf(n, font.fontSize) },
    pinned: false,
  }));
  const graph = graphOf(seeds, edges.map((e) => ({ id: edgeIdOf(e), from: e.from, to: e.to })));
  const moved = (opts.layout ?? layered)(graph, opts.layoutOptions ?? { order: 'barycenter' });

  const specs: DiagramSpec[] = [];
  for (const [i, n] of data.nodes.entries()) {
    const seed = seeds[i]!.bounds;
    const at = moved.get(n.id) ?? seed;
    const pose = { x: at.x, y: at.y, width: seed.width, height: seed.height };
    const style = opts.nodeStyle?.(n) ?? NODE;
    specs.push({
      id: n.id as never,
      kind: 'container',
      layer: 'main',
      pose,
      data: {
        diagram: { outline: 'rect' },
        fill: { color: style.fill },
        stroke: { paint: { color: style.stroke }, width: style.strokeWidth ?? 2 },
      },
    });
    for (const [k, text] of n.lines.entries()) {
      specs.push({
        kind: 'leaf',
        layer: 'main',
        parent: n.id as never,
        pickable: false,
        pose: {
          x: pose.x + PAD.x,
          y: pose.y + PAD.y + k * LINE * font.fontSize,
          width: pose.width - 2 * PAD.x,
          height: LINE * font.fontSize,
        },
        data: { text, style: font, fill: { color: style.text } },
      });
    }
  }
  for (const e of edges) {
    const id = edgeIdOf(e);
    const style = opts.edgeStyle?.(e) ?? EDGE;
    specs.push({
      id: id as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: {
        diagram: { from: {}, to: {}, router: opts.router ?? 'bezier' },
        stroke: { paint: { color: style.stroke }, width: style.width ?? 1.5, markerEnd: 'arrow' },
      },
      dependsOn: [e.from as never, e.to as never],
      derivePath: EDGE_DERIVE_PATH,
    });
    if (e.label) {
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pickable: false,
        pose: { x: 0, y: 0, width: e.label.length * GLYPH * (font.fontSize - 2), height: font.fontSize },
        data: {
          diagram: { label: { at: 'mid', offset: 9 } },
          text: e.label,
          style: { ...font, fontSize: font.fontSize - 2 },
          fill: { color: style.stroke },
        },
        dependsOn: [id as never],
        derivePose: LABEL_DERIVE_POSE as never,
      });
    }
  }
  return specs;
}
