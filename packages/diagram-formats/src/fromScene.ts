/** A diagram scene as a {@link DiagramDocument}: what every format writes from. */
import {
  AUTO_POSE_DESCRIPTOR, documentPose, pageHolding, placedPagesOf, type PlacedPage, type PoseDescriptor, type RectPose, type Scene,
} from '@weasel-js/core';
import {
  DIAGRAM_THEME_KEY, diagramLabelOf, diagramThemeFrom, offPageSplits, type DataContainer, type DataEdge, type DataGroup,
  type DataNode, type DiagramTheme,
} from '@weasel-js/diagram';
import type { DiagramDocument, DocumentPage } from './document';
import { kindOf, readEdge, readGroup, readRegion, readShape, type ReadNode, type ReadScene } from './sceneReaders';

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

interface PageBucket { nodes: DataNode[]; edges: DataEdge[]; groups: DataGroup[]; containers: DataContainer[] }

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
 * page's corner. A shape belongs to the page its outermost container does, and
 * that is the one its box overlaps most, or the nearest one when it overlaps
 * none. A connector the scene splits off-page, or whose ends export to
 * different pages, goes in `crossPageEdges`: without waypoints when split,
 * with them in world coordinates when not. Colors are kept
 * where the scene's theme would not give them: the author's own, and any a
 * theme never set.
 */
export function documentFromScene<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>, opts: DocumentFromSceneOptions = {},
): DiagramDocument {
  const s = scene as unknown as AnyScene;
  const themeValue = s.doc.get(DIAGRAM_THEME_KEY) as DiagramDocument['theme'];
  const theme = diagramThemeFrom(themeValue, opts.theme);
  const placed = placedPagesOf(scene);
  const pages = placed.length > 0 ? placed : [contentPage(s)];
  const buckets = new Map(pages.map((p) => [p.id, { nodes: [], edges: [], groups: [], containers: [] } as PageBucket]));
  const boxOf = (node: ReadNode) => (AUTO_POSE_DESCRIPTOR as PoseDescriptor<unknown>).getBounds(documentPose(s as never, node as never));
  const pageCache = new Map<string, PlacedPage>();
  const pageOf = (node: ReadNode): PlacedPage => {
    let root = node;
    while (root.parent !== null) root = s.get(root.parent as never)!;
    if (!pageCache.has(root.id)) pageCache.set(root.id, pageHolding(pages, boxOf(root))!);
    return pageCache.get(root.id)!;
  };

  const labels = new Map<string, ReadNode>();
  const edges: ReadNode[] = [];
  const itemPage = new Map<string, PlacedPage>();
  for (const node of s.renderOrderNodes()) {
    const kind = kindOf(node);
    if (kind === null) {
      const deps = node.dependsOn;
      if (diagramLabelOf(node) !== null && Array.isArray(deps) && deps.length === 1) labels.set(deps[0]!, node);
      continue;
    }
    if (kind === 'edge') {
      edges.push(node);
      continue;
    }
    const page = pageOf(node);
    itemPage.set(node.id, page);
    const bucket = buckets.get(page.id)!;
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
    const split = splits.get(node.id) !== null;
    if (fromPage === toPage && !split) buckets.get(fromPage.id)!.edges.push(readEdge(node, labels.get(node.id), fromPage, theme));
    else crossPageEdges.push(readEdge(node, labels.get(node.id), split ? null : { x: 0, y: 0 }, theme));
  }

  return {
    pages: pages.map((p): DocumentPage => {
      const { nodes, edges: pageEdges, groups, containers } = buckets.get(p.id)!;
      return {
        id: p.id,
        ...(p.name !== undefined ? { name: p.name } : {}),
        width: p.width,
        height: p.height,
        data: { nodes, edges: pageEdges, ...(groups.length > 0 ? { groups } : {}), ...(containers.length > 0 ? { containers } : {}) },
      };
    }),
    ...(crossPageEdges.length > 0 ? { crossPageEdges } : {}),
    ...(themeValue !== undefined ? { theme: themeValue } : {}),
  };
}

const isContainerOrPool = (node: ReadNode): boolean => {
  const trait = (node.data as { diagram?: { container?: { role?: string } } }).diagram;
  return trait?.container?.role === 'container' || trait?.container?.role === 'pool';
};
