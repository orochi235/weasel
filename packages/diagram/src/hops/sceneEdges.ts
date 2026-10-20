/**
 * A scene's connectors as line jumps read them: each one's route before any
 * hop, and the data write that stores its hops.
 */
import { AUTO_POSE_DESCRIPTOR, createSetDataOp, documentPose, type DerivedDep, type Op, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { edgeRouter, type EdgeRouteOptions } from '../edge';
import { diagramEdgeOf, type DiagramEdge } from '../edgeTrait';
import type { EdgeHop } from './types';

export type AnyScene = Scene<unknown, string, unknown>;
export type SceneNode = ReturnType<AnyScene['renderOrderNodes']>[number];

/** A connector: its node and the ids of its two ends. */
export interface SceneEdge {
  node: SceneNode;
  trait: DiagramEdge;
  ends: readonly [string, string];
}

/** Every connector in `scene`, in render order. */
export function sceneEdges(scene: AnyScene): SceneEdge[] {
  const out: SceneEdge[] = [];
  for (const node of scene.renderOrderNodes()) {
    const trait = diagramEdgeOf(node);
    const ends = node.dependsOn;
    if (trait === null || !Array.isArray(ends) || ends.length !== 2) continue;
    out.push({ node, trait, ends: [ends[0]!, ends[1]!] });
  }
  return out;
}

/** A function from a connector to the points it is routed through, as its
 *  `derivePath` routes it before drawing any hop; null where it draws nothing. */
export function edgePolylines<TPose>(scene: AnyScene, opts: EdgeRouteOptions<TPose> = {}): (edge: SceneEdge) => Vec2[] | null {
  const route = edgeRouter<unknown>({ geometry: AUTO_POSE_DESCRIPTOR, ...(opts as EdgeRouteOptions<unknown>) });
  const dep = (id: string): DerivedDep<unknown> | undefined => {
    const node = scene.get(id as never);
    return node === undefined ? undefined : ({ node, pose: documentPose(scene, node as never), path: null } as DerivedDep<unknown>);
  };
  return (edge) => {
    const points = route(edge.node, [dep(edge.ends[0]), dep(edge.ends[1])])?.points;
    return points === undefined || points.length < 2 ? null : [...points];
  };
}

/** Whether `id`, or a node it sits in, is in `ids`. */
export function inOrUnder(scene: AnyScene, id: string, ids: { has(id: string): boolean }): boolean {
  for (let at: string | null | undefined = id; at != null; at = scene.get(at as never)?.parent) {
    if (ids.has(at)) return true;
  }
  return false;
}

/** `data` with its edge trait holding `hops`, or none when the list is empty. */
export function withHopsData(data: unknown, trait: DiagramEdge, hops: readonly EdgeHop[]): Record<string, unknown> {
  const { hops: _h, ...rest } = trait;
  return { ...(data as Record<string, unknown>), diagram: hops.length === 0 ? rest : { ...rest, hops } };
}

const sameHop = (a: EdgeHop, b: EdgeHop): boolean =>
  a.at.x === b.at.x && a.at.y === b.at.y && a.r === b.r && a.over.length === b.over.length && a.over.every((o, i) => o === b.over[i]);

/** The data writes that store `hops` on their connectors, skipping any unchanged. */
export function hopDataOps(scene: AnyScene, hops: ReadonlyMap<string, readonly EdgeHop[]>): Op[] {
  const ops: Op[] = [];
  for (const [id, list] of hops) {
    const node = scene.get(id as never);
    const trait = node === undefined ? null : diagramEdgeOf(node);
    if (node === undefined || trait === null) continue;
    const had = trait.hops ?? [];
    if (had.length === list.length && had.every((h, i) => sameHop(h, list[i]!))) continue;
    ops.push(createSetDataOp({ id, from: node.data, to: withHopsData(node.data, trait, list), label: 'Line jumps' }));
  }
  return ops;
}
