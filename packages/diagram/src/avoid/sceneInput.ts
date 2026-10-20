/**
 * A diagram scene as the avoid router reads it: every participant, container,
 * pool, group box, and header as an obstacle, and every `avoid` connector not
 * split across pages, with the ports each end may use and its label. A split
 * connector's label, on its first stub, is an obstacle of its own.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  documentPose,
  type PoseDescriptor,
  type Scene,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramContainerOf, headerBox } from '../containers/trait';
import { diagramEdgeOf } from '../edgeTrait';
import { diagramGroupOf } from '../group';
import { diagramLabelOf } from '../labelTrait';
import { portSitesOf, portsOf, type PortsOptions } from '../ports';
import { diagramNodeOf } from '../trait';
import type { Port } from '../types';
import type { AvoidEdge, AvoidInput, AvoidLabel, AvoidObstacle, AvoidPort } from './types';

/** How a scene is read for routing. */
export interface AvoidSceneOptions<TPose> extends PortsOptions<TPose> {
  /** The router key whose connectors are routed. Default `'avoid'`. */
  routerKey?: string;
}

type AnyScene = Scene<unknown, string, unknown>;
type SceneNode = ReturnType<AnyScene['renderOrderNodes']>[number];

/** The id of a container's header obstacle. */
export const headerIdOf = (id: string): string => `${id}/header`;

const facingPorts = (ports: readonly Port[]): AvoidPort[] =>
  ports.flatMap((p) => (p.normal === null ? [] : [{ point: p.point, normal: p.normal }]));

/** Every id under `node`, at any depth: its children, or what a derived group box holds. */
function members(scene: AnyScene, node: SceneNode, into: Set<string>): Set<string> {
  const under = Array.isArray(node.dependsOn) && diagramGroupOf(node) !== null ? node.dependsOn : scene.childrenOf(node.id as never);
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
 * each node at the pose `poseOf` gives it, else the one the document holds.
 */
export function avoidSceneInput<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: AvoidSceneOptions<TPose> = {},
  poseOf?: (id: string) => TPose | undefined,
): AvoidInput {
  const sc = scene as unknown as AnyScene;
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const portOpts: PortsOptions<TPose> = { geometry, ...(opts.read ? { read: opts.read } : {}) };
  const key = opts.routerKey ?? 'avoid';
  const poses = new Map<string, TPose>();
  const pose = (node: SceneNode): TPose => {
    let p = poses.get(node.id);
    if (p === undefined) {
      p = poseOf?.(node.id) ?? (documentPose(sc, node as never) as TPose);
      poses.set(node.id, p);
    }
    return p;
  };

  const obstacles: AvoidObstacle[] = [];
  const edgeNodes: SceneNode[] = [];
  const labels = new Map<string, AvoidLabel>();
  const labelNodes = new Map<string, SceneNode>();
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
      const { width, height } = geometry.getBounds(node.pose as TPose);
      if (owner !== undefined && !labels.has(owner)) {
        labels.set(owner, { id: node.id, placement: label, size: { width, height } });
        labelNodes.set(owner, node);
      }
      continue;
    }
    const container = diagramContainerOf(node);
    const isParticipant = diagramNodeOf(node as never, opts.read) !== null;
    if (!isParticipant && container?.role !== 'lane') continue;
    const box = geometry.getBounds(pose(node));
    const header = container === null ? null : headerBox(box, container.header);
    if (header !== null) obstacles.push({ id: headerIdOf(node.id), kind: 'shape', box: header });
    if (container?.role === 'lane') continue;
    const region = container !== null || diagramGroupOf(node) !== null;
    obstacles.push(region
      ? { id: node.id, kind: 'region', box, members: members(sc, node, new Set()) }
      : { id: node.id, kind: 'shape', box });
  }

  for (const id of split) {
    const node = labelNodes.get(id);
    if (node !== undefined) obstacles.push({ id: node.id, kind: 'label', edge: id, box: geometry.getBounds(pose(node)) });
  }

  const edges: AvoidEdge[] = [];
  for (const node of edgeNodes) {
    const edge = diagramEdgeOf(node)!;
    const ends = node.dependsOn;
    if (!Array.isArray(ends) || ends.length !== 2) continue;
    if (ends[0] === ends[1] && edge.from.port === undefined && edge.to.port === undefined) continue;
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
      ...(labels.has(node.id) ? { label: labels.get(node.id)! } : {}),
    });
  }
  return { obstacles, edges };
}
