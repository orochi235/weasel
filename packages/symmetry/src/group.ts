import type { Affine, Point } from '@weasel-js/geom';
import { clipNothing, type AddNodeSpec, type CopiesFromPoseFn, type NodeId, type Scene, type SceneRegistry } from '@weasel-js/core';
import { DEFAULT_SYMMETRY, SYMMETRY_KINDS, symmetryTransforms, type SymmetrySpec } from './kinds';

/** What a symmetry group keeps in its `data`. Its center is its pose. */
export interface SymmetryGroupData {
  symmetry: SymmetrySpec;
}

/** The box a symmetry group is posed at: empty, at its center. */
export interface SymmetryPose {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a group's copies turn and reflect about: the middle of its pose. */
export function centerOfPose(pose: unknown): Point {
  const p = pose as Partial<SymmetryPose>;
  return { x: (p.x ?? 0) + (p.width ?? 0) / 2, y: (p.y ?? 0) + (p.height ?? 0) / 2 };
}

/** The pose that puts a group's center at `c`. */
export function poseAtCenter(c: Point): SymmetryPose {
  return { x: c.x, y: c.y, width: 0, height: 0 };
}

/** The spec a group's `data` holds, with any field it lacks at its default. */
export function specOfData(data: unknown): SymmetrySpec {
  const s = (data as Partial<SymmetryGroupData> | null | undefined)?.symmetry;
  return { ...DEFAULT_SYMMETRY, ...s };
}

/** A symmetry group's copies: the `copiesFromPose` every group carries. */
export const symmetryCopies: CopiesFromPoseFn<unknown> = (pose, node) =>
  symmetryTransforms(specOfData(node.data), centerOfPose(pose));

/** The registry key a group's `copiesFromPose` is saved under. */
export const SYMMETRY_COPIES_KEY = 'weasel-symmetry:copies';
/** The registry key a group's `clipFromPose`, core's `clipNothing`, is saved
 *  under: a group draws its copies wherever they land. */
export const SYMMETRY_CLIP_KEY = 'weasel-symmetry:no-clip';

/**
 * The entries a scene needs to save and restore symmetry groups: pass it to
 * `createScene({ registry })`, merged with any of your own. Without it a
 * group still draws its copies, but `toJSON` refuses the scene.
 */
export const symmetryRegistry: SceneRegistry<unknown> = {
  copiesFromPose: { [SYMMETRY_COPIES_KEY]: symmetryCopies },
  clipFromPose: { [SYMMETRY_CLIP_KEY]: clipNothing },
};

/** What {@link symmetryGroupSpec} builds a group from. */
export interface SymmetryGroupOptions<TLayer extends string = string> {
  layer: TLayer;
  center: Point;
  symmetry?: Partial<SymmetrySpec>;
  id?: NodeId;
  parent?: NodeId | null;
  index?: number;
}

/** The `scene.add` spec for a new, empty symmetry group. */
export function symmetryGroupSpec<TLayer extends string>(
  opts: SymmetryGroupOptions<TLayer>,
): AddNodeSpec<SymmetryGroupData, TLayer, SymmetryPose> {
  return {
    kind: 'container',
    layer: opts.layer,
    pose: poseAtCenter(opts.center),
    data: { symmetry: { ...DEFAULT_SYMMETRY, ...opts.symmetry } },
    clipFromPose: clipNothing,
    copiesFromPose: symmetryCopies as CopiesFromPoseFn<SymmetryPose, SymmetryGroupData, TLayer>,
    ...(opts.id !== undefined ? { id: opts.id } : {}),
    ...(opts.parent !== undefined ? { parent: opts.parent } : {}),
    ...(opts.index !== undefined ? { index: opts.index } : {}),
  };
}


/** Whether `id` names a symmetry group in `scene`. */
export function isSymmetryGroup(scene: Scene<unknown, string, unknown>, id: NodeId | string | null | undefined): boolean {
  if (id == null) return false;
  const node = scene.get(id as NodeId);
  return node?.kind === 'container' && node.copiesFromPose === symmetryCopies;
}

/** The nearest symmetry group holding `id`, or `id` itself when it is one. */
export function symmetryGroupOf(scene: Scene<unknown, string, unknown>, id: NodeId | string): NodeId | null {
  let cur: NodeId | null = id as NodeId;
  const seen = new Set<string>();
  while (cur !== null && !seen.has(cur)) {
    if (isSymmetryGroup(scene, cur)) return cur;
    seen.add(cur);
    cur = scene.get(cur)?.parent ?? null;
  }
  return null;
}

/** The spec and center of group `id`, or `null` when it is not one. */
export function readGroup(scene: Scene<unknown, string, unknown>, id: NodeId | string | null): { spec: SymmetrySpec; center: Point } | null {
  if (!isSymmetryGroup(scene, id)) return null;
  const node = scene.get(id as NodeId)!;
  return { spec: specOfData(node.data), center: centerOfPose(scene.overrides.read(node.id)?.pose ?? node.pose) };
}

/**
 * Every transform a path inside group `id` should stay its own image under
 * while it is edited, or none for a kind that is not a group. In world
 * coordinates, for the `pathSymmetry` dep.
 */
export function editSymmetries(scene: Scene<unknown, string, unknown>, id: NodeId | string | null): Affine[] {
  const g = readGroup(scene, id);
  if (g === null || !SYMMETRY_KINDS[g.spec.kind].group) return [];
  return symmetryTransforms(g.spec, g.center);
}
