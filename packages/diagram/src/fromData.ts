/**
 * `diagramScene` — a laid-out diagram from plain `{ nodes, edges }`.
 *
 * Every box is a `buildBody` body, so a data node can say anything a body
 * can: outline, rows, padding, ports. Sizes are estimated from character
 * counts unless `measure` is given, so layout runs without a canvas and gives
 * the same answer in node and in a browser.
 */
import type { AddNodeSpec, MarkerRef, RectPose, Stroke } from '@weasel-js/core';
import { buildBody, measureBody, sizeToBody, type MeasureRowText, type Row, type RowTextStyle } from './body';
import { EDGE_DERIVE_PATH, type DiagramEdge } from './edge';
import { force } from './force';
import type { Graph, GraphEdge, GraphNode } from './graph';
import { LABEL_DERIVE_POSE, type DiagramLabel } from './label';
import { layered } from './layered';
import type { LayoutFn, LayoutOptions } from './layout';
import type { Outline } from './outline';
import { tree } from './tree';
import type { DiagramNode, PortSpec } from './types';
import type { Vec2 } from '@weasel-js/core/math';

export interface DataNode {
  id: string;
  /** Shorthand for one `label` row per line. Ignored when `rows` is given. */
  lines?: readonly string[];
  rows?: readonly Row[];
  /** Default `DiagramSceneOptions.outline`, which defaults to `'rect'`. */
  outline?: Outline;
  /** Perimeter ports, replacing the four compass midpoints. */
  ports?: readonly PortSpec[];
  /** Layout leaves this node at `at`. */
  pinned?: boolean;
  /** Where the node starts, before layout. Unset, nodes start on the
   *  diagonal in source order, which is what within-rank order is seeded
   *  from. */
  at?: Vec2;
  /** The smallest the box may be. Its content grows it past this. */
  width?: number;
  height?: number;
  /** Default `DiagramSceneOptions.padding`. */
  padding?: number;
  /** Default `DiagramSceneOptions.gap`. */
  gap?: number;
}

export interface DataEdge {
  from: string;
  to: string;
  /** The port to leave from or arrive at. Unset, the end facing the other
   *  node most directly. */
  fromPort?: string;
  toPort?: string;
  label?: string;
  /** Where along the edge the label sits. Default `DiagramSceneOptions.labelPlacement`. */
  labelPlacement?: DiagramLabel;
  /** Default `DiagramSceneOptions.router`. */
  router?: Router;
  /** World points the route passes through. Layout does not move them. */
  waypoints?: readonly Vec2[];
}

export interface DiagramData { nodes: readonly DataNode[]; edges: readonly DataEdge[] }

export interface NodeStyle {
  fill: string;
  stroke: string;
  text: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface EdgeStyle {
  stroke: string;
  width?: number;
  dash?: number[];
  /** `null` for none. Default none. */
  markerStart?: MarkerRef | null;
  /** `null` for none. Default `'arrow'`. */
  markerEnd?: MarkerRef | null;
  /** Default `stroke`. */
  label?: string;
}

type Router = 'straight' | 'bezier' | 'orthogonal';
type TextStyle = { fontFamily: string; fontSize: number; fontWeight?: number };

export interface DiagramSceneData {
  diagram?: DiagramNode | DiagramEdge | { label: DiagramLabel };
  fill?: { color: string };
  stroke?: Stroke;
  text?: string;
  style?: TextStyle;
}

export type DiagramSpec = AddNodeSpec<DiagramSceneData, 'main', RectPose>;

export interface DiagramSceneOptions {
  /** A layout by name, or any `LayoutFn`. Default `'layered'`. */
  layout?: 'layered' | 'tree' | 'force' | LayoutFn;
  /** Merged over `{ order: 'barycenter' }`. */
  layoutOptions?: LayoutOptions;
  /** Default `'bezier'`. */
  router?: Router;
  /** The text style rows fall back on. Default 12px sans-serif. */
  font?: { fontFamily: string; fontSize: number };
  /** Measures one run of text. Default an estimate from character count, so
   *  layout needs no canvas; pass `canvasMeasure(ctx)` for real widths. */
  measure?: MeasureRowText;
  /** Default `'rect'`. */
  outline?: Outline;
  /** Between a box's outline and its rows. Default 8. */
  padding?: number;
  /** Between adjacent rows. Default 4. */
  gap?: number;
  /** The narrowest a box may be. Default 64. */
  minWidth?: number;
  /** Where edge labels sit. Default `{ at: 'mid', offset: 9 }`. */
  labelPlacement?: DiagramLabel;
  nodeStyle?: (node: DataNode) => NodeStyle;
  edgeStyle?: (edge: DataEdge) => EdgeStyle;
}

const FONT = { fontFamily: 'sans-serif', fontSize: 12 };
const NODE: NodeStyle = { fill: '#16222c', stroke: '#7ba7c7', text: '#dbe7f2' };
const EDGE: EdgeStyle = { stroke: '#7ba7c7' };
const LABEL_PLACEMENT: DiagramLabel = { at: 'mid', offset: 9 };
const LINE = 1.4;
const GLYPH = 0.6;
const MIN_WIDTH = 64;
const LAYOUTS = { layered, tree, force } as const;

export const edgeIdOf = (e: DataEdge) =>
  `edge:${e.from}${e.fromPort ? `.${e.fromPort}` : ''}->${e.to}${e.toPort ? `.${e.toPort}` : ''}${e.label ? `:${e.label}` : ''}`;

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
 *  the same ends, ports and label: it would draw exactly on top of the first. */
export function diagramScene(data: DiagramData, opts: DiagramSceneOptions = {}): DiagramSpec[] {
  const font = opts.font ?? FONT;
  const styleOf = (s: RowTextStyle | undefined): TextStyle => ({
    fontFamily: s?.fontFamily ?? font.fontFamily,
    fontSize: s?.fontSize ?? font.fontSize,
    ...(s?.bold === true ? { fontWeight: 700 } : {}),
  });
  const measure: MeasureRowText = opts.measure
    ? (text, s) => opts.measure!(text, { ...s, fontFamily: s.fontFamily ?? font.fontFamily, fontSize: s.fontSize ?? font.fontSize })
    : (text, s) => {
        const size = s.fontSize ?? font.fontSize;
        return { width: text.length * GLYPH * size, height: Math.ceil(LINE * size) };
      };

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

  const bodies = data.nodes.map((n) => ({
    outline: n.outline ?? opts.outline ?? 'rect',
    rows: n.rows ?? (n.lines ?? []).map((text): Row => ({ kind: 'label', text })),
    padding: n.padding ?? opts.padding ?? 8,
    gap: n.gap ?? opts.gap ?? 4,
    ...(n.ports ? { ports: n.ports } : {}),
  }));
  // Seeded on the diagonal in source order, so whichever axis a layout reads
  // for in-rank order, it starts from the data's own order.
  const seeds: GraphNode[] = data.nodes.map((n, i) => {
    const pose = sizeToBody(
      { ...(n.at ?? { x: i, y: i }), width: n.width ?? opts.minWidth ?? MIN_WIDTH, height: n.height ?? 0 },
      measureBody(bodies[i]!, measure),
    );
    return { id: n.id, bounds: pose, pinned: n.pinned === true };
  });
  const graph = graphOf(seeds, edges.map((e) => ({ id: edgeIdOf(e), from: e.from, to: e.to })));
  const layout = typeof opts.layout === 'function' ? opts.layout : LAYOUTS[opts.layout ?? 'layered'];
  const moved = layout(graph, { order: 'barycenter', ...opts.layoutOptions });

  const specs: DiagramSpec[] = [];
  for (const [i, n] of data.nodes.entries()) {
    const seed = seeds[i]!.bounds;
    const at = moved.get(n.id) ?? seed;
    const style = opts.nodeStyle?.(n) ?? NODE;
    const textData = (text: string, s: RowTextStyle | undefined): DiagramSceneData =>
      ({ text, style: styleOf(s), fill: { color: style.text } });
    const built = buildBody<DiagramSceneData, 'main', RectPose>(
      bodies[i]!,
      { x: at.x, y: at.y, width: seed.width, height: seed.height },
      {
        id: n.id,
        layer: 'main',
        measure,
        body: (trait) => ({
          diagram: n.pinned === true ? { ...trait, pinned: true } : trait,
          fill: { color: style.fill },
          stroke: {
            paint: { color: style.stroke },
            width: style.strokeWidth ?? 2,
            ...(style.dash ? { dash: style.dash } : {}),
          },
        }),
        row: (text, box) =>
          text === '' ? null : textData(text, box.row.kind === 'label' || box.row.kind === 'field' ? box.row.style : undefined),
        portLabel: (text) => textData(text, undefined),
      },
    );
    for (const s of built.specs) specs.push(s as DiagramSpec);
  }

  for (const e of edges) {
    const id = edgeIdOf(e);
    const style = opts.edgeStyle?.(e) ?? EDGE;
    const markerStart = style.markerStart ?? null;
    const markerEnd = style.markerEnd === undefined ? 'arrow' : style.markerEnd;
    specs.push({
      id: id as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: {
        diagram: {
          from: e.fromPort ? { port: e.fromPort } : {},
          to: e.toPort ? { port: e.toPort } : {},
          router: e.router ?? opts.router ?? 'bezier',
          ...(e.waypoints ? { waypoints: e.waypoints } : {}),
        },
        stroke: {
          paint: { color: style.stroke },
          width: style.width ?? 1.5,
          ...(style.dash ? { dash: style.dash } : {}),
          ...(markerStart !== null ? { markerStart } : {}),
          ...(markerEnd !== null ? { markerEnd } : {}),
        },
      },
      dependsOn: [e.from as never, e.to as never],
      derivePath: EDGE_DERIVE_PATH,
    });
    if (e.label) {
      const labelStyle = { ...font, fontSize: font.fontSize - 2 };
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pickable: false,
        pose: { x: 0, y: 0, width: measure(e.label, labelStyle).width, height: labelStyle.fontSize },
        data: {
          diagram: { label: e.labelPlacement ?? opts.labelPlacement ?? LABEL_PLACEMENT },
          text: e.label,
          style: labelStyle,
          fill: { color: style.label ?? style.stroke },
        },
        dependsOn: [id as never],
        derivePose: LABEL_DERIVE_POSE as never,
      });
    }
  }
  return specs;
}
