/**
 * A path effect as a scene node: a leaf whose `dependsOn` names its sources,
 * whose `data.pathEffect` says what to make of them, and whose path and pose
 * are both derived — the path to paint and pick, the pose as that path's
 * bounds, so selection chrome and marquee see where it is.
 */
import { boundsOfPath, type Path } from '@weasel-js/geom';
import { pathFromParts, type DerivedPart } from '../derivedParts';
import { samePoseValue, snapshotPose } from '../poseSnapshot';
import type { DerivedDep, NodeId } from '../types';
import { effectParts, type PathEffect } from './effects';
import { effectSourceOf } from './source';

/** The registry key both derivations go by, for `derivePath` and `derivePose`. */
export const PATH_EFFECT = 'kit:pathEffect';

/** A node's path effect, or `null` when its data holds none. */
export function pathEffectOf(node: { data?: unknown } | undefined): PathEffect | null {
  const effect = (node?.data as { pathEffect?: PathEffect } | null | undefined)?.pathEffect;
  return effect && typeof effect === 'object' && typeof effect.kind === 'string' ? effect : null;
}

interface Derived {
  data: unknown;
  nodes: unknown[];
  depData: unknown[];
  poses: unknown[];
  paths: (Path | null)[];
  parts: DerivedPart[] | null;
  path: Path | null;
}

/** One result per effect node, shared by its two derivations: the pose is the
 *  path's bounds, and working the effect out twice a frame would double its
 *  cost. Checked against everything it read, by value for poses — a drag's
 *  override mutates its pose in place. */
const RESULTS = new WeakMap<object, Derived>();

function derive(node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): Derived {
  const held = RESULTS.get(node);
  if (held !== undefined && current(held, node, deps)) return held;
  const effect = pathEffectOf(node);
  const parts = effect === null ? null : effectParts(effect, deps.map(effectSourceOf));
  const result: Derived = {
    data: node.data,
    nodes: deps.map((d) => d?.node),
    depData: deps.map((d) => d?.node.data),
    poses: deps.map((d) => (d === undefined ? undefined : snapshotPose(d.pose))),
    paths: deps.map((d) => d?.path ?? null),
    parts,
    path: parts === null ? null : pathFromParts(parts),
  };
  RESULTS.set(node, result);
  return result;
}

function current(held: Derived, node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): boolean {
  if (held.data !== node.data || held.nodes.length !== deps.length) return false;
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i];
    if (held.nodes[i] !== d?.node) return false;
    if (d === undefined) continue;
    if (held.depData[i] !== d.node.data || !samePoseValue(held.poses[i], d.pose)) return false;
    if (held.paths[i] !== d.path) return false;
  }
  return true;
}

/** `derivePath` for a path-effect node. */
export function pathEffectDerivePath(
  node: { data?: unknown },
  deps: readonly (DerivedDep<unknown> | undefined)[],
): Path | null {
  return derive(node, deps).path;
}

/** `derivePose` for a path-effect node: the bounds of what it paints, or
 *  `null` — its authored pose — while it paints nothing. */
export function pathEffectDerivePose(
  node: { data?: unknown },
  deps: readonly (DerivedDep<unknown> | undefined)[],
): { x: number; y: number; width: number; height: number } | null {
  const path = derive(node, deps).path;
  if (path === null) return null;
  const { x, y, width, height } = boundsOfPath(path);
  return { x, y, width, height };
}

/** The parts a path-effect node paints, as its sources stand. */
export function pathEffectParts(
  node: { data?: unknown },
  deps: readonly (DerivedDep<unknown> | undefined)[],
): readonly DerivedPart[] | null {
  return derive(node, deps).parts;
}

/** What to hand `Scene.add` (or an insert op) for a path-effect node over
 *  `sources`, in the order its kind reads them. */
export function pathEffectNode<TLayer extends string>(
  effect: PathEffect,
  sources: readonly NodeId[],
  layer: TLayer,
): {
  kind: 'leaf';
  layer: TLayer;
  pose: { x: number; y: number; width: number; height: number };
  data: { pathEffect: PathEffect };
  dependsOn: readonly NodeId[];
  derivePath: typeof pathEffectDerivePath;
  derivePose: typeof pathEffectDerivePose;
} {
  return {
    kind: 'leaf',
    layer,
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { pathEffect: effect },
    dependsOn: [...sources],
    derivePath: pathEffectDerivePath,
    derivePose: pathEffectDerivePose,
  };
}
