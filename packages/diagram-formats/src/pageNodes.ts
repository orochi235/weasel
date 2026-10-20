/**
 * One page of a diagram scene as `SvgNode`s: the nodes whose box meets the
 * page, each written the way the canvas paints it.
 */
import {
  boundsOfPath,
  derivedDepOf,
  derivedPartsOf,
  effectivePose,
  isAnnotationLayer,
  type DrawCommand,
  type NodeShapeEntry,
  type Paint,
  type Path,
  type RectPose,
  type Scene,
} from '@weasel-js/core';
import { diagramShape, markShape } from '@weasel-js/diagram';
import {
  svgLeafFromKit,
  svgNodesFromKit,
  svgPaintFromKit,
  svgStrokeFromKit,
  type SvgGroupNode,
  type SvgKitLeafData,
  type SvgKitPose,
  type SvgKitTree,
  type SvgKitTreeNode,
  type SvgNode,
  type SvgPathNode,
} from '@weasel-js/svg';

/** A page's rect in world space. A `PlacedPage` is one. */
export interface PageRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A diagram scene as the exports read it: world-space `RectPose`s. */
export type PageExportScene = Scene<unknown, string, RectPose>;

type Box = { x: number; y: number; width: number; height: number };
type SceneNode = NonNullable<ReturnType<PageExportScene['get']>>;

const meets = (a: Box, b: Box): boolean =>
  Math.min(a.x + a.width, b.x + b.width) >= Math.max(a.x, b.x)
  && Math.min(a.y + a.height, b.y + b.height) >= Math.max(a.y, b.y);

const poseOf = (pose: RectPose): SvgKitPose => ({
  x: pose.x, y: pose.y, width: pose.width, height: pose.height,
  ...(pose.rotation ? { rotation: pose.rotation } : {}),
});

/** A painter's path command as an SVG path, its paints resolved in `box`. */
function commandNode(cmd: DrawCommand, pose: SvgKitPose): SvgPathNode | null {
  if (cmd.kind !== 'path') return null;
  const node: SvgPathNode = { kind: 'path', path: cmd.path, fill: svgPaintFromKit((cmd.fill?.paint ?? null) as Paint | null, pose) };
  const stroke = svgStrokeFromKit(cmd.stroke as Parameters<typeof svgStrokeFromKit>[0], pose);
  if (stroke) node.stroke = stroke;
  if (pose.rotation) node.rotation = pose.rotation;
  return node;
}

/** What a diagram painter draws for `node`, or `null` when none claims it. */
function diagramPainted(painters: readonly NodeShapeEntry<unknown, RectPose>[], node: SceneNode, pose: RectPose): SvgPathNode[] | null {
  const painter = painters.find((p) => p.matches(node as never));
  if (!painter) return null;
  const at = poseOf(pose);
  return painter.paint(node as never, pose).flatMap((cmd) => commandNode(cmd, at) ?? []);
}

/** A derived path's parts, each painted as the derived-node painter paints it. */
function derivedNodes(path: Path, data: SvgKitLeafData): SvgNode[] {
  const parts = derivedPartsOf(path) ?? [{ path }];
  return parts.flatMap((part) => svgLeafFromKit({
    path: part.path,
    ...(part.fill !== undefined ? { fill: part.fill } : data.fill !== undefined ? { fill: data.fill } : {}),
    stroke: part.stroke !== undefined ? part.stroke : data.stroke,
  }, boundsOfPath(part.path)) ?? []);
}

const one = (nodes: SvgNode[]): SvgNode | null =>
  nodes.length === 0 ? null : nodes.length === 1 ? nodes[0]! : { kind: 'group', children: nodes };

/**
 * The `SvgNode`s of everything on `page`, in paint order: every node on a
 * visible content layer whose box meets the page, with what is under it.
 * Diagram outlines and drawn marks go through the diagram painters, a node
 * that derives its path (a connector) is drawn along that path, and anything
 * else is written by `svgLeafFromKit`.
 */
export function pageSvgNodes(scene: PageExportScene, page: PageRect): SvgNode[] {
  const painters = [diagramShape<RectPose>(), markShape<RectPose>()];
  const shown = new Set(scene.layers.filter((l) => l.visible && !isAnnotationLayer(l)).map((l) => l.id));
  const poseCache = new Map<string, RectPose>();
  const pose = (node: SceneNode): RectPose => {
    let p = poseCache.get(node.id);
    if (p === undefined) poseCache.set(node.id, (p = effectivePose(scene, node)));
    return p;
  };
  const pathOf = (node: SceneNode) => (node.kind === 'leaf' ? derivedDepOf(scene, node.id)?.path ?? null : null);

  const tree: SvgKitTree = {
    roots: scene.layers.flatMap((l) => scene.roots.filter((id) => scene.get(id)?.layer === l.id)),
    childrenOf: (id) => scene.childrenOf(id as never),
    get(id) {
      const node = scene.get(id as never);
      if (!node) return undefined;
      return {
        kind: node.kind, data: node.data, pose: poseOf(pose(node)),
        ...(node.hidden ? { hidden: true } : {}),
        ...(node.kind === 'container' && node.copiesFromPose
          ? { copiesFromPose: node.copiesFromPose as SvgKitTreeNode['copiesFromPose'] }
          : {}),
      };
    },
  };

  return svgNodesFromKit(tree, {
    include(id) {
      const node = scene.get(id as never);
      if (!node || !shown.has(node.layer)) return false;
      const path = pathOf(node);
      return meets(path ? boundsOfPath(path) : pose(node), page);
    },
    leaf(id, kit) {
      const node = scene.get(id as never)!;
      const path = pathOf(node);
      if (path) return one(derivedNodes(path, kit.data as SvgKitLeafData));
      const painted = diagramPainted(painters, node, pose(node));
      return painted ? one(painted) : svgLeafFromKit(kit.data as SvgKitLeafData, kit.pose);
    },
    group(id, g): SvgGroupNode {
      const node = scene.get(id as never)!;
      const outline = diagramPainted(painters, node, pose(node));
      return outline ? { ...g, children: [...outline, ...g.children] } : g;
    },
  });
}
