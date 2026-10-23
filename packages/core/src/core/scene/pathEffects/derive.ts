/**
 * A path effect as a scene node: a leaf whose `dependsOn` names its sources,
 * whose `data.pathEffect` says what to make of them, and whose path and pose
 * are both derived — the path to paint and pick, the pose as that path's
 * bounds, so selection chrome and marquee see where it is.
 *
 * Reading a source's outline and paint is its painter's business, which sits
 * above the scene, so the derivations are made from a reader:
 * `createPathEffectDerivations(read)`. The canvas layer makes the kit's, and
 * a scene that holds path effects registers them under {@link PATH_EFFECT}.
 */
import { boundsOfPath, type Path } from '@weasel-js/geom';
import { derivedPartsOf, pathFromParts, type DerivedPart } from '../derivedParts';
import { fontGeneration, noteFontRead, withFontReads } from '../fontReads';
import { samePoseValue, snapshotPose } from '../poseSnapshot';
import type { DerivedDep, NodeId } from '../types';
import { effectParts, type PathEffect } from './effects';
import type { EffectSourceReader } from './source';

/** The registry key both derivations go by, for `derivePath` and `derivePose`. */
export const PATH_EFFECT = 'kit:pathEffect';

/** A node's path effect, or `null` when its data holds none. */
export function pathEffectOf(node: { data?: unknown } | undefined): PathEffect | null {
  const effect = (node?.data as { pathEffect?: PathEffect } | null | undefined)?.pathEffect;
  return effect && typeof effect === 'object' && typeof effect.kind === 'string' ? effect : null;
}

/** A path-effect node's two derivations. */
export interface PathEffectDerivations {
  /** What it paints and picks by. */
  derivePath(node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): Path | null;
  /** The bounds of what it paints, or `null` — its authored pose — while it
   *  paints nothing. */
  derivePose(node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): { x: number; y: number; width: number; height: number } | null;
}

interface Derived {
  data: unknown;
  nodes: unknown[];
  depData: unknown[];
  poses: unknown[];
  paths: (Path | null)[];
  inherited: unknown[];
  path: Path | null;
  /** The face generation it was worked out under, or `null` when it read no
   *  glyph outlines. */
  faces: number | null;
}

/** The derivations of a path effect whose sources `read` reads. */
export function createPathEffectDerivations(read: EffectSourceReader): PathEffectDerivations {
  /** One result per effect node, shared by its two derivations: the pose is
   *  the path's bounds, and working the effect out twice a frame would double
   *  its cost. Checked against everything it read, by value for poses — a
   *  drag's override mutates its pose in place. */
  const results = new WeakMap<object, Derived>();
  const derive = (node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): Derived => {
    const held = results.get(node);
    if (held !== undefined && current(held, node, deps)) return held;
    const effect = pathEffectOf(node);
    const generation = fontGeneration();
    const { value: parts, fonts } = withFontReads(() => (effect === null
      ? null
      : effectParts(effect, deps.map((d) => (d === undefined ? null : read(d))))));
    const result: Derived = {
      data: node.data,
      nodes: deps.map((d) => d?.node),
      depData: deps.map((d) => d?.node.data),
      poses: deps.map((d) => (d === undefined ? undefined : snapshotPose(d.pose))),
      paths: deps.map((d) => d?.path ?? null),
      inherited: deps.map((d) => d?.inherited),
      path: parts === null ? null : pathFromParts(parts),
      faces: fonts ? generation : null,
    };
    results.set(node, result);
    return result;
  };
  return {
    derivePath: (node, deps) => derive(node, deps).path,
    derivePose: (node, deps) => {
      const path = derive(node, deps).path;
      if (path === null) return null;
      const { x, y, width, height } = boundsOfPath(path);
      return { x, y, width, height };
    },
  };
}

function current(held: Derived, node: { data?: unknown }, deps: readonly (DerivedDep<unknown> | undefined)[]): boolean {
  if (held.data !== node.data || held.nodes.length !== deps.length) return false;
  if (held.faces !== null && held.faces !== fontGeneration()) return false;
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i];
    if (held.nodes[i] !== d?.node) return false;
    if (d === undefined) continue;
    if (held.depData[i] !== d.node.data || !samePoseValue(held.poses[i], d.pose)) return false;
    if (held.paths[i] !== d.path || held.inherited[i] !== d.inherited) return false;
  }
  // A hit is still a read, for the scene memo enclosing this one.
  if (held.faces !== null) noteFontRead();
  return true;
}

/** The parts a path-effect node paints, as its sources stand, or `null` when
 *  it has no derivation or nothing to paint. */
export function pathEffectParts(
  node: { data?: unknown; derivePath?: unknown },
  deps: readonly (DerivedDep<unknown> | undefined)[],
): readonly DerivedPart[] | null {
  if (typeof node.derivePath !== 'function') return null;
  return derivedPartsOf((node.derivePath as PathEffectDerivations['derivePath'])(node, deps)) ?? null;
}

/** What to hand `Scene.add` (or an insert op) for a path-effect node over
 *  `sources`, in the order its kind reads them, deriving through
 *  `derivations` — the ones the scene registers under {@link PATH_EFFECT}. */
export function pathEffectNode<TLayer extends string>(
  effect: PathEffect,
  sources: readonly NodeId[],
  layer: TLayer,
  derivations: PathEffectDerivations,
): {
  kind: 'mark';
  layer: TLayer;
  pose: { x: number; y: number; width: number; height: number };
  data: { pathEffect: PathEffect };
  dependsOn: readonly NodeId[];
  derivePath: PathEffectDerivations['derivePath'];
  derivePose: PathEffectDerivations['derivePose'];
} {
  return {
    kind: 'mark',
    layer,
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { pathEffect: effect },
    dependsOn: [...sources],
    derivePath: derivations.derivePath,
    derivePose: derivations.derivePose,
  };
}

/** The path-effect derivations `registry` holds under {@link PATH_EFFECT},
 *  or `null` when it holds none. */
export function registeredPathEffects(registry: {
  derivePath?: Readonly<Record<string, unknown>>;
  derivePose?: Readonly<Record<string, unknown>>;
}): PathEffectDerivations | null {
  const derivePath = registry.derivePath?.[PATH_EFFECT];
  const derivePose = registry.derivePose?.[PATH_EFFECT];
  return typeof derivePath === 'function' && typeof derivePose === 'function'
    ? { derivePath, derivePose } as PathEffectDerivations
    : null;
}
