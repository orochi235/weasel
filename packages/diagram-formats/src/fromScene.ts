/** A diagram scene as a {@link DiagramDocument}: what every format writes from. */
import {
  composeWorldPose, pageHolding, placedPagesOf, scenePoseAdapter, type PlacedPage, type RectPose, type Scene,
} from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, diagramLabelOf, documentBoundsOf, endLabelIdOf, diagramThemeFrom, offPageSplits, sequenceRootOf, type DataContainer,
  type DataEdge, type DataGroup, type DataNode, type DiagramTheme, type SequenceData,
} from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage, GraphPage, PlotPage } from './document';
import { graphPageSettingsOf } from './graphPageMeta';
import { plotPageOf } from './plotPages';
import { kindOf, readEdge, readGroup, readRegion, readShape, type EndLabelNodes, type ReadNode, type ReadScene } from './sceneReaders';

/** Options for {@link documentFromScene}. */
export interface DocumentFromSceneOptions {
  /** The theme colors are read against when the scene's `diagram:theme` names none. Default the night theme. */
  theme?: DiagramTheme;
}

type AnyScene = ReadScene & {
  roots: readonly string[];
  renderOrderNodes(): readonly ReadNode[];
  doc: { get(key: string): unknown };
};

interface PageBucket {
  nodes: DataNode[]; edges: DataEdge[]; groups: DataGroup[]; containers: DataContainer[];
  /** The first sequence on the page, which makes it a sequence page. */
  sequence?: SequenceData;
}

/** One page around everything, for a scene with no page list. */
function contentPage(scene: AnyScene): PlacedPage {
  const boxes = scene.roots.map((id) => scene.get(id as never)!.pose as RectPose);
  const x = boxes.length === 0 ? 0 : Math.min(...boxes.map((b) => b.x));
  const y = boxes.length === 0 ? 0 : Math.min(...boxes.map((b) => b.y));
  const width = boxes.length === 0 ? 0 : Math.max(...boxes.map((b) => b.x + b.width)) - x;
  const height = boxes.length === 0 ? 0 : Math.max(...boxes.map((b) => b.y + b.height)) - y;
  return { id: 'page-1', x, y, width, height, index: 0 };
}

/**
 * Reads a diagram scene into a document: one page per page in its `core:pages`
 * (one page around everything when it has none), each holding the shapes,
 * connectors, containers and pools, and groups on it, in coordinates from the
 * page's corner; a page holding a plot root is a plot page of its spec, and
 * whatever else is on it is left out. A shape belongs to the page its outermost container does, and
 * that is the one its box overlaps most, or the nearest one when it overlaps
 * none. A connector the scene splits off-page, or whose ends export to
 * different pages, goes in `crossPageEdges`: without waypoints when split,
 * with them in world coordinates when not. Colors are kept
 * where the scene's theme would not give them: the author's own, and any a
 * theme never set. A page holding a sequence's root is a sequence page holding
 * its data; the parts drawn from it, and anything else on that page, are not read.
 * A graph page takes the notation, layout, and direction its scene page keeps.
 */
export function documentFromScene<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, opts: DocumentFromSceneOptions = {},
): DiagramDocument {
  const s = inWorld(scene);
  const themeValue = s.doc.get(DIAGRAM_THEME_KEY) as DiagramDocument['theme'];
  const theme = diagramThemeFrom(themeValue, opts.theme);
  const placed = placedPagesOf(scene);
  const pages = placed.length > 0 ? placed : [contentPage(s)];
  const buckets = new Map(pages.map((p) => [p.id, { nodes: [], edges: [], groups: [], containers: [] } as PageBucket]));
  const boxOf = (node: ReadNode) => documentBoundsOf(scene, node);
  const pageCache = new Map<string, PlacedPage>();
  const pageOf = (node: ReadNode): PlacedPage => {
    let root = node;
    while (root.parent !== null) root = s.get(root.parent as never)!;
    if (!pageCache.has(root.id)) pageCache.set(root.id, pageHolding(pages, boxOf(root))!);
    return pageCache.get(root.id)!;
  };

  const plots = new Map<string, PlotPage>();
  for (const node of s.renderOrderNodes()) {
    const page = plotPageOf(pageOf(node), node);
    if (page !== null && !plots.has(page.id)) plots.set(page.id, page);
  }

  const labels = new Map<string, ReadNode>();
  const endLabels = new Map<string, EndLabelNodes>();
  const edges: ReadNode[] = [];
  const itemPage = new Map<string, PlacedPage>();
  for (const node of s.renderOrderNodes()) {
    const kind = kindOf(node);
    if (kind === null) {
      const deps = node.dependsOn;
      if (diagramLabelOf(node) === null || !Array.isArray(deps) || deps.length !== 1) continue;
      const edge = deps[0]!;
      const end = node.id === endLabelIdOf(edge, 'from') ? 'from' : node.id === endLabelIdOf(edge, 'to') ? 'to' : null;
      if (end === null) labels.set(edge, node);
      else endLabels.set(edge, { ...endLabels.get(edge), [end]: node });
      continue;
    }
    if (kind === 'edge') {
      edges.push(node);
      continue;
    }
    const page = pageOf(node);
    itemPage.set(node.id, page);
    const bucket = buckets.get(page.id)!;
    if (kind === 'sequence') {
      bucket.sequence ??= sequenceRootOf(node)!.sequence;
      continue;
    }
    if (kind === 'shape') bucket.nodes.push(readShape(s, node, page, theme));
    else if (kind === 'group') bucket.groups.push(readGroup(s, node));
    else if (isContainerOrPool(node)) bucket.containers.push(readRegion(s, node, page, theme));
  }

  const splitInputs = edges.flatMap((node) => {
    const [from, to] = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    if (from === undefined || to === undefined || !itemPage.has(from) || !itemPage.has(to)) return [];
    return [{ id: node.id, from: boxOf(s.get(from as never)!), to: boxOf(s.get(to as never)!) }];
  });
  const splits = offPageSplits({ pages, edges: splitInputs });
  const crossPageEdges: DataEdge[] = [];
  for (const node of edges) {
    const [from, to] = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    const fromPage = itemPage.get(from ?? '');
    const toPage = itemPage.get(to ?? '');
    if (fromPage === undefined || toPage === undefined) continue;
    const split = (splits.get(node.id) ?? null) !== null;
    const read = (page: PlacedPage | { x: number; y: number } | null) =>
      readEdge(node, { label: labels.get(node.id), ends: endLabels.get(node.id) }, page, theme);
    if (fromPage === toPage && !split) buckets.get(fromPage.id)!.edges.push(read(fromPage));
    else crossPageEdges.push(read(split ? null : { x: 0, y: 0 }));
  }

  return {
    pages: pages.map((p): DocumentPage => {
      const plot = plots.get(p.id);
      if (plot !== undefined) return plot;
      const { nodes, edges: pageEdges, groups, containers, sequence } = buckets.get(p.id)!;
      const base = { id: p.id, ...(p.name !== undefined ? { name: p.name } : {}), width: p.width, height: p.height };
      if (sequence !== undefined) return { kind: 'sequence', ...base, data: sequence };
      return {
        kind: 'graph',
        ...base,
        ...graphPageSettingsOf(p),
        data: { nodes, edges: pageEdges, ...(groups.length > 0 ? { groups } : {}), ...(containers.length > 0 ? { containers } : {}) },
      } satisfies GraphPage;
    }),
    ...(crossPageEdges.length > 0 ? { crossPageEdges } : {}),
    ...(themeValue !== undefined ? { theme: themeValue } : {}),
  };
}

const isContainerOrPool = (node: ReadNode): boolean => {
  const trait = (node.data as { diagram?: { container?: { role?: string } } }).diagram;
  return trait?.container?.role === 'container' || trait?.container?.role === 'pool';
};

/** `scene` read with every node at the pose it is drawn at in document space. */
function inWorld<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>): AnyScene {
  const raw = scene as unknown as AnyScene;
  const poses = scenePoseAdapter(scene as never);
  const placed = (node: ReadNode): ReadNode => ({ ...node, pose: composeWorldPose(poses, node.id, scene.composition.compose as never) });
  return {
    roots: raw.roots,
    doc: raw.doc,
    childrenOf: (id) => raw.childrenOf(id),
    get: (id) => {
      const node = raw.get(id);
      return node === undefined ? undefined : placed(node);
    },
    renderOrderNodes: () => raw.renderOrderNodes().map(placed),
  };
}
