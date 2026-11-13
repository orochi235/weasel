/**
 * One page of a scene as `SvgNode`s: the nodes whose box meets the page, each
 * written the way the canvas paints it.
 */
import {
  boundsOfPath,
  composeWorldPose,
  contentRoots,
  derivedDepOf,
  derivedPartsOf,
  documentOf,
  effectivePose,
  findNodeShape,
  INHERIT,
  resolvePartPaint,
  isAnnotationLayer,
  scenePoseAdapter,
  type DrawCommand,
  type NodeShapeEntry,
  type Paint,
  type Path,
  type RectPose,
  type Scene,
} from '@weasel-js/core';
import {
  svgLeafFromKit,
  svgNodesFromKit,
  svgPaintFromKit,
  svgStrokeFromKit,
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

/** A scene as the exports read it: world-space `RectPose`s. */
export type PageExportScene = Scene<unknown, string, RectPose>;

/** Options for {@link pageSvgNodes}. */
export interface PageSvgNodesOptions {
  /** Painters asked before the registered ones (`registerNodeShape`), the
   *  first that claims a node drawing it: for a kind the scene draws with a
   *  painter it may not have registered. */
  painters?: readonly NodeShapeEntry<unknown, RectPose>[];
}

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

/**
 * The painter that draws `node` in the export: the first of `painters` to
 * claim it, else a registered one. The kit's own (`kit:*`) are left to
 * `svgLeafFromKit`, which writes their text, images and markers as SVG.
 */
function painterOf(painters: readonly NodeShapeEntry<unknown, RectPose>[], node: SceneNode): NodeShapeEntry<unknown, RectPose> | undefined {
  const given = painters.find((p) => p.matches(node as never));
  if (given) return given;
  const registered = findNodeShape(node);
  return registered && !registered.id.startsWith('kit:') ? registered : undefined;
}

/** What `painter` draws for `node`, as SVG paths. */
function painted(painter: NodeShapeEntry<unknown, RectPose>, node: SceneNode, pose: RectPose): SvgPathNode[] {
  const at = poseOf(pose);
  return painter.paint(node as never, pose).flatMap((cmd) => commandNode(cmd, at) ?? []);
}

/** A derived path's parts, each painted as the derived-node painter paints it. */
function derivedNodes(path: Path, data: SvgKitLeafData): SvgNode[] {
  const parts = derivedPartsOf(path) ?? [{ path, fill: INHERIT, stroke: INHERIT }];
  return parts.flatMap((part) => svgLeafFromKit(
    { path: part.path, ...resolvePartPaint(part, data) },
    boundsOfPath(part.path),
  ) ?? []);
}

const one = (nodes: SvgNode[]): SvgNode | null =>
  nodes.length === 0 ? null : nodes.length === 1 ? nodes[0]! : { kind: 'group', children: nodes };

const derives = (node: SceneNode): boolean =>
  node.kind !== 'group' && (node.dependsOn?.length ?? 0) > 0 && node.derivePath !== undefined;

/**
 * The `SvgNode`s of everything on `page`, in paint order: every node on a
 * visible content layer whose box meets the page, with what is under it. A
 * node a consumer painter claims (one of `opts.painters`, else one registered
 * with `registerNodeShape`) is written from that painter's paths, a node that
 * derives its path (a connector) is drawn along that path, and anything else
 * is written by `svgLeafFromKit`.
 */
export function pageSvgNodes(live: PageExportScene, page: PageRect, opts: PageSvgNodesOptions = {}): SvgNode[] {
  // An export writes the document, not what an open gesture or edit is showing.
  const scene = documentOf(live);
  const painters = opts.painters ?? [];
  const shown = new Set(scene.layers.filter((l) => l.visible && !isAnnotationLayer(l)).map((l) => l.id));
  const poseCache = new Map<string, RectPose>();
  // A child stores its pose in its parent's frame; the walk below is handed every pose in the world.
  const poses = { ...scenePoseAdapter(scene as never), getPose: (id: string) => effectivePose(scene, scene.get(id as never)!) };
  const pose = (node: SceneNode): RectPose => {
    let p = poseCache.get(node.id);
    if (p === undefined) poseCache.set(node.id, (p = composeWorldPose(poses as never, node.id, scene.composition.compose as never) as RectPose));
    return p;
  };
  const pathOf = (node: SceneNode) => (derives(node) ? derivedDepOf(scene, node.id)?.path ?? null : null);

  // The page run and pages frame what is on them; a page's export writes that content, not the frames.
  const tops = contentRoots(scene);
  const tree: SvgKitTree = {
    roots: scene.layers.flatMap((l) => tops.filter((id) => scene.get(id)?.layer === l.id)),
    childrenOf: (id) => scene.childrenOf(id as never),
    get(id) {
      const node = scene.get(id as never);
      if (!node) return undefined;
      return {
        kind: node.kind, data: node.data, pose: poseOf(pose(node)),
        ...(node.hidden ? { hidden: true } : {}),
        ...(node.clip ? { clip: node.clip } : {}),
        ...(node.copiesFromPose ? { copiesFromPose: node.copiesFromPose as SvgKitTreeNode['copiesFromPose'] } : {}),
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
      const painter = painterOf(painters, node);
      return painter ? one(painted(painter, node, pose(node))) : svgLeafFromKit(kit.data as SvgKitLeafData, kit.pose);
    },
  });
}
