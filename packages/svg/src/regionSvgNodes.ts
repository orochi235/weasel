/**
 * One region of a scene as `SvgNode`s: the nodes whose box meets the region,
 * each written the way the canvas paints it.
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
  nodeShapesOf,
  INHERIT,
  resolvePartPaint,
  isAnnotationLayer,
  scenePoseAdapter,
  type NodeShapeEntry,
  type NodeShapes,
  type Path,
  type RectPose,
} from '@weasel-js/core';
import type { ExportRegion, ExportScene } from '@weasel-js/export';
import {
  svgLeafFromKit,
  svgNodesFromKit,
  type SvgKitLeafData,
  type SvgKitPose,
  type SvgKitTree,
  type SvgKitTreeNode,
} from './fromKit';
import { svgFromPainter, warnOncePerCall } from './painterLeaf';
import type { SvgNode } from './types';

/** Options for {@link regionSvgNodes}. */
export interface RegionSvgNodesOptions {
  /** Painters asked before the registered ones (`registerNodeShape`), the
   *  first that claims a node drawing it: for a kind the scene draws with a
   *  painter it may not have registered. */
  painters?: readonly NodeShapeEntry<unknown, RectPose>[];
  /** Hears what a painter drew that SVG cannot hold, once per kind. Without
   *  it each kind is said once with `console.warn`. */
  onWarn?: (message: string) => void;
}

type Box = { x: number; y: number; width: number; height: number };
type SceneNode = NonNullable<ReturnType<ExportScene['get']>>;

const meets = (a: Box, b: Box): boolean =>
  Math.min(a.x + a.width, b.x + b.width) >= Math.max(a.x, b.x)
  && Math.min(a.y + a.height, b.y + b.height) >= Math.max(a.y, b.y);

const poseOf = (pose: RectPose): SvgKitPose => ({
  x: pose.x, y: pose.y, width: pose.width, height: pose.height,
  ...(pose.rotation ? { rotation: pose.rotation } : {}),
  ...(pose.transform ? { transform: pose.transform } : {}),
});

/**
 * The painter that draws `node` in the export: the first of `painters` to
 * claim it, else a registered one. The kit's own (`kit:*`) are left to
 * `svgLeafFromKit`, which writes their text, images and markers as SVG.
 */
function painterOf(
  painters: readonly NodeShapeEntry<unknown, RectPose>[], node: SceneNode, shapes: NodeShapes,
): NodeShapeEntry<unknown, RectPose> | undefined {
  const given = painters.find((p) => p.matches(node as never));
  if (given) return given;
  const registered = findNodeShape(node, shapes);
  return registered && !registered.id.startsWith('kit:') ? registered : undefined;
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
 * The `SvgNode`s of everything in `region`, in paint order: every node on a
 * visible content layer whose box meets the region, with what is under it. A
 * node a consumer painter claims (one of `opts.painters`, else one registered
 * with `registerNodeShape`) is written from that painter's paths, a node that
 * derives its path (a connector) is drawn along that path, and anything else
 * is written by `svgLeafFromKit`.
 */
export function regionSvgNodes(live: ExportScene, region: ExportRegion, opts: RegionSvgNodesOptions = {}): SvgNode[] {
  // An export writes the document, not what an open gesture or edit is showing.
  const scene = documentOf(live);
  const painters = opts.painters ?? [];
  const warn = warnOncePerCall(opts.onWarn);
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

  // The page run and pages frame what is on them; an export writes that content, not the frames.
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

  const shapes = nodeShapesOf(scene);
  return svgNodesFromKit(tree, {
    shapes,
    ...(opts.onWarn ? { onWarn: opts.onWarn } : {}),
    include(id) {
      const node = scene.get(id as never);
      if (!node || !shown.has(node.layer)) return false;
      const path = pathOf(node);
      return meets(path ? boundsOfPath(path) : pose(node), region);
    },
    leaf(id, kit, inherited) {
      const node = scene.get(id as never)!;
      const path = pathOf(node);
      if (path) return one(derivedNodes(path, kit.data as SvgKitLeafData));
      const painter = painterOf(painters, node, shapes);
      return painter ? svgFromPainter(painter as NodeShapeEntry, node, kit.pose, inherited, warn) : undefined;
    },
  });
}
