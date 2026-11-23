/**
 * A diagram scene as the avoid router reads it: every participant, container,
 * pool, cluster box, and header as an obstacle, and every `avoid` connector not
 * split across pages, with the ports each end may use and its labels. A split
 * connector's labels, on its stubs, are obstacles of their own.
 */
import {
  documentPose,
  AUTO_POSE_DESCRIPTOR,
  type PoseDescriptor,
  type Scene,
  type AnyScene,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramContainerOf, headerBox } from '../containers/trait';
import { diagramEdgeOf } from '../edgeTrait';
import { diagramClusterOf } from '../clusterBox';
import { diagramLabelOf } from '../labelTrait';
import { portSitesOf, portsOf, type PortsOptions } from '../ports';
import { diagramNodeOf } from '../trait';
import { worldWith } from '../worldWith';
import type { Port } from '../types';
import type { AvoidEdge, AvoidInput, AvoidLabel, AvoidObstacle, AvoidPort } from './types';

/** How a scene is read for routing. */
export interface AvoidSceneOptions<TPose> extends PortsOptions<TPose> {
  /** The router key whose connectors are routed. Default `'avoid'`. */
  routerKey?: string;
}

type SceneNode = ReturnType<AnyScene['renderOrderNodes']>[number];

/** The id of a container's header obstacle. */
export const headerIdOf = (id: string): string => `${id}/header`;

/** The ports of `ports` that face a direction, as the router takes them. */
export const facingPorts = (ports: readonly Port[]): AvoidPort[] =>
  ports.flatMap((p) => (p.normal === null ? [] : [{ point: p.point, normal: p.normal }]));

/** Every id under `node`, at any depth: its children, or what a derived cluster box holds. */
function members(scene: AnyScene, node: SceneNode, into: Set<string>): Set<string> {
  const under = Array.isArray(node.dependsOn) && diagramClusterOf(node) !== null ? node.dependsOn : scene.childrenOf(node.id as never);
  for (const id of under) {
    if (into.has(id)) continue;
    into.add(id);
    const child = scene.get(id as never);
    if (child !== undefined) members(scene, child, into);
  }
  return into;
}

/**
 * What the router reads off `scene`: its obstacles and its `avoid` connectors,
 * each node where it draws once `frame`'s stored poses, a transform frame's,
 * are written in place of the document's.
 */
export function avoidSceneInput<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: AvoidSceneOptions<TPose> = {},
  frame: ReadonlyMap<string, TPose> = new Map(),
): AvoidInput {
  const sc = scene as unknown as AnyScene;
  const poseDescriptor = opts.poseDescriptor ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const portOpts: PortsOptions<TPose> = { poseDescriptor, ...(opts.read ? { read: opts.read } : {}) };
  const key = opts.routerKey ?? 'avoid';
  const poses = new Map<string, TPose>();
  const world = worldWith(sc, frame, (node) => documentPose(sc, node));
  const pose = (node: SceneNode): TPose => {
    let p = poses.get(node.id);
    if (p === undefined) {
      p = world(node.id) as TPose;
      poses.set(node.id, p);
    }
    return p;
  };

  const obstacles: AvoidObstacle[] = [];
  const edgeNodes: SceneNode[] = [];
  const labels = new Map<string, AvoidLabel[]>();
  const labelNodes = new Map<string, SceneNode[]>();
  const split: string[] = [];
  for (const node of sc.renderOrderNodes()) {
    const edge = diagramEdgeOf(node);
    if (edge !== null) {
      if (edge.router === key && edge.offPage === undefined) edgeNodes.push(node);
      else if (edge.router === key) split.push(node.id);
      continue;
    }
    const label = diagramLabelOf(node);
    if (label !== null) {
      const owner = Array.isArray(node.dependsOn) ? node.dependsOn[0] : undefined;
      const { width, height } = poseDescriptor.getBounds(node.pose as TPose);
      if (owner !== undefined) {
        labels.set(owner, [...(labels.get(owner) ?? []), { id: node.id, placement: label, size: { width, height } }]);
        labelNodes.set(owner, [...(labelNodes.get(owner) ?? []), node]);
      }
      continue;
    }
    const container = diagramContainerOf(node);
    const isParticipant = diagramNodeOf(node as never, opts.read) !== null;
    if (!isParticipant && container?.role !== 'lane') continue;
    const box = poseDescriptor.getBounds(pose(node));
    const header = container === null ? null : headerBox(box, container.header);
    if (header !== null) obstacles.push({ id: headerIdOf(node.id), kind: 'shape', box: header });
    if (container?.role === 'lane') continue;
    const region = container !== null || diagramClusterOf(node) !== null;
    obstacles.push(region
      ? { id: node.id, kind: 'region', box, members: members(sc, node, new Set()) }
      : { id: node.id, kind: 'shape', box });
  }

  for (const id of split) {
    for (const node of labelNodes.get(id) ?? []) obstacles.push({ id: node.id, kind: 'label', edge: id, box: poseDescriptor.getBounds(pose(node)) });
  }

  const edges: AvoidEdge[] = [];
  for (const node of edgeNodes) {
    const edge = diagramEdgeOf(node)!;
    const ends = node.dependsOn;
    if (!Array.isArray(ends) || ends.length !== 2) continue;
    if (ends[0] === ends[1] && (edge.from.port === undefined || edge.to.port === undefined)) continue;
    const [a, b] = ends.map((id) => sc.get(id as never));
    if (a === undefined || b === undefined) continue;
    const portsAt = (n: SceneNode, port: string | undefined) => facingPorts(port === undefined
      ? portsOf(n as never, pose(n), portOpts)
      : portSitesOf(n as never, pose(n), port, portOpts));
    const from = portsAt(a, edge.from.port);
    const to = portsAt(b, edge.to.port);
    if (from.length === 0 || to.length === 0) continue;
    edges.push({
      id: node.id,
      from: { node: a.id, ports: from },
      to: { node: b.id, ports: to },
      ...(edge.waypoints !== undefined && edge.waypoints.length > 0 ? { waypoints: edge.waypoints as Vec2[] } : {}),
      ...(edge.route !== undefined ? { route: edge.route } : {}),
      ...(sc.isLocked(node.id as never) ? { locked: true } : {}),
      ...(labels.has(node.id) ? { labels: labels.get(node.id)! } : {}),
    });
  }
  return { obstacles, edges };
}
